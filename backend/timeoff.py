import json
import logging
import os
import re
import uuid
from datetime import date, datetime
from typing import Any

from holidays import workdays_from, get_us_holidays, is_workday

log = logging.getLogger("timeoff")

TIMEOFF_FILE = "timeoff.json"
ENTRIES_FILE = "timeoff_entries.json"

DATE_PAIR_RE = re.compile(r'(\d{2}/\d{2}/\d{4})(\d{2}/\d{2}/\d{4})')
HOURS_RE = re.compile(r'(\d+)\s+Hours?')


# ── Simple schedule store (auto-remove) ───────────────────────────────────

def load_timeoff(data_path: str) -> dict[str, list[str]]:
    path = os.path.join(data_path, TIMEOFF_FILE)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_timeoff(data_path: str, schedule: dict[str, list[str]]):
    path = os.path.join(data_path, TIMEOFF_FILE)
    _atomic_write(path, schedule)


def get_out_today(data_path: str) -> list[str]:
    schedule = load_timeoff(data_path)
    return schedule.get(date.today().isoformat(), [])


def get_out_on(data_path: str, target_date: date) -> list[str]:
    schedule = load_timeoff(data_path)
    return schedule.get(target_date.isoformat(), [])


# ── Entries store (rich metadata) ─────────────────────────────────────────

def load_entries(data_path: str) -> list[dict]:
    path = os.path.join(data_path, ENTRIES_FILE)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_entries(data_path: str, entries: list[dict]):
    path = os.path.join(data_path, ENTRIES_FILE)
    _atomic_write(path, entries)


def rebuild_schedule(data_path: str):
    """Rebuild timeoff.json from entries."""
    entries = load_entries(data_path)
    schedule: dict[str, list[str]] = {}
    for entry in entries:
        name = entry.get("name", "")
        for day in entry.get("workdays", []):
            schedule.setdefault(day, [])
            if name not in schedule[day]:
                schedule[day].append(name)
    save_timeoff(data_path, schedule)


def add_manual_entry(
    data_path: str,
    name: str,
    start_date: date,
    num_days: int,
    note: str = "",
) -> dict:
    days = workdays_from(start_date, num_days)
    entry = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "start_date": start_date.isoformat(),
        "end_date": days[-1].isoformat() if days else start_date.isoformat(),
        "num_days": num_days,
        "workdays": [d.isoformat() for d in days],
        "source": "manual",
        "note": note,
    }
    entries = load_entries(data_path)
    entries.append(entry)
    save_entries(data_path, entries)
    rebuild_schedule(data_path)
    return entry


def delete_entry(data_path: str, entry_id: str) -> bool:
    entries = load_entries(data_path)
    new_entries = [e for e in entries if e.get("id") != entry_id]
    if len(new_entries) == len(entries):
        return False
    save_entries(data_path, new_entries)
    rebuild_schedule(data_path)
    return True


def import_adp_entries(data_path: str, adp_entries: list[dict]) -> int:
    """Import ADP-parsed entries, replacing existing ADP entries for same person+date."""
    existing = load_entries(data_path)

    # Build set of (name, date) pairs being imported
    new_pairs: set[tuple] = set()
    for e in adp_entries:
        name = e.get("roster_name") or e.get("adp_name") or e.get("name")
        date_str = e.get("date")
        if name and date_str:
            new_pairs.add((name, date_str))

    # Keep non-ADP entries and ADP entries not being replaced
    kept = [
        e for e in existing
        if e.get("source") != "adp" or (e.get("name"), e.get("start_date")) not in new_pairs
    ]

    added = 0
    for adp in adp_entries:
        name = adp.get("roster_name") or adp.get("adp_name") or adp.get("name")
        date_str = adp.get("date")
        if not name or not date_str:
            continue
        kept.append({
            "id": str(uuid.uuid4())[:8],
            "name": name,
            "start_date": date_str,
            "end_date": date_str,
            "num_days": 1,
            "workdays": [date_str],
            "source": "adp",
            "note": f"ADP import — {adp.get('hours', 8)}h",
        })
        added += 1

    save_entries(data_path, kept)
    rebuild_schedule(data_path)
    return added


# ── PDF Parsing ────────────────────────────────────────────────────────────

def parse_adp_pdf(pdf_bytes: bytes) -> list[dict[str, Any]]:
    try:
        import pdfplumber
        import io
    except ImportError:
        raise RuntimeError("pdfplumber not installed")

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    log.info("Extracted %d characters from PDF", len(full_text))
    entries = _parse_lines(full_text)
    log.info("Parsed %d approved/pending PTO entries", len(entries))
    return entries


def _parse_lines(text: str) -> list[dict[str, Any]]:
    lines = text.split("\n")
    entries = []
    seen: set[tuple] = set()
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        if not line.startswith("JYP "):
            i += 1
            continue

        name_match = re.match(r'JYP\s+([A-Z][a-zA-Z\-]+),', line)
        if not name_match:
            i += 1
            continue

        last_name = name_match.group(1)

        # Try full "LastName, FirstName" on same line first
        full_match = re.match(r'JYP\s+([A-Z][a-zA-Z\-]+,\s+[A-Z][a-z]+)', line)
        if full_match:
            full_name = full_match.group(1)
        else:
            first_name = ""
            if i + 1 < len(lines):
                nw = lines[i + 1].strip().split()
                if nw and re.match(r'^[A-Z][a-z]+$', nw[0]):
                    first_name = nw[0]
            full_name = f"{last_name}, {first_name}" if first_name else last_name

        date_match = DATE_PAIR_RE.search(line)
        if not date_match:
            i += 1
            continue

        time_off_date_str = date_match.group(2)

        if "Approved" in line:
            status = "Approved"
        elif "Pending" in line:
            status = "Pending"
        elif "Canceled" in line or "Cancelled" in line:
            i += 1
            continue
        else:
            i += 1
            continue

        if "Flex Hybrid" in line or "PTO" not in line:
            i += 1
            continue

        try:
            time_off_date = datetime.strptime(time_off_date_str, "%m/%d/%Y").date()
        except ValueError:
            i += 1
            continue

        h = HOURS_RE.search(line)
        hours = int(h.group(1)) if h else 8

        key = (full_name, time_off_date.isoformat())
        if key not in seen:
            seen.add(key)
            entries.append({
                "adp_name": full_name,
                "date": time_off_date.isoformat(),
                "status": status,
                "policy": "PTO",
                "hours": hours,
            })
        i += 1

    return entries


# ── Nickname & Name Matching ───────────────────────────────────────────────

NICKNAMES: dict[str, list[str]] = {
    "Gabriel": ["Gabe"], "Zachary": ["Zach", "Zack"],
    "Robert": ["Rob", "Bob", "Bobby"], "Richard": ["Rick", "Rich"],
    "Kimberly": ["Kim"], "Katherine": ["Kate", "Katie", "Kathy"],
    "Christina": ["Chris", "Tina"], "Christopher": ["Chris"],
    "Michael": ["Mike"], "Jonathan": ["Jon"], "Matthew": ["Matt"],
    "Timothy": ["Tim"], "Nicholas": ["Nick"],
    "William": ["Will", "Bill"], "Benjamin": ["Ben"],
    "Alexander": ["Alex"], "Andrew": ["Andy", "Drew"],
    "Anthony": ["Tony"], "Daniel": ["Dan"], "David": ["Dave"],
    "Edward": ["Ed"], "Elizabeth": ["Liz", "Beth"],
    "James": ["Jim"], "Jennifer": ["Jen"],
    "Joseph": ["Joe"], "Joshua": ["Josh"],
    "Kenneth": ["Ken"], "Lawrence": ["Larry"],
    "Patricia": ["Pat"], "Patrick": ["Pat"],
    "Rebecca": ["Becky"], "Samuel": ["Sam"],
    "Stephen": ["Steve"], "Steven": ["Steve"],
    "Susan": ["Sue"], "Theodore": ["Ted"],
    "Thomas": ["Tom"], "Vincent": ["Vince"],
}

_NICK_REV: dict[str, list[str]] = {}
for _f, _ns in NICKNAMES.items():
    for _n in _ns:
        _NICK_REV.setdefault(_n.lower(), []).append(_f.lower())


def _nickname_match(first: str, roster_lower: dict[str, str]) -> str | None:
    fl = first.lower()
    for nick in NICKNAMES.get(first.capitalize(), []):
        if nick.lower() in roster_lower:
            return roster_lower[nick.lower()]
    for formal_lower in _NICK_REV.get(fl, []):
        if formal_lower in roster_lower:
            return roster_lower[formal_lower]
        for nick in NICKNAMES.get(formal_lower.capitalize(), []):
            if nick.lower() in roster_lower:
                return roster_lower[nick.lower()]
    return None


def match_names(entries, roster, adp_name_map):
    roster_lower = {n.lower(): n for n in roster}
    for entry in entries:
        adp_name = entry["adp_name"]
        if adp_name in adp_name_map:
            entry["roster_name"] = adp_name_map[adp_name]
            continue
        parts = adp_name.split(",")
        first_name = parts[1].strip().split()[0] if len(parts) >= 2 else adp_name
        if first_name.lower() in roster_lower:
            entry["roster_name"] = roster_lower[first_name.lower()]
            continue
        nick = _nickname_match(first_name, roster_lower)
        if nick:
            entry["roster_name"] = nick
            continue
        entry["roster_name"] = None
    return entries


# ── Helpers ────────────────────────────────────────────────────────────────

def _atomic_write(path: str, data: Any):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)
