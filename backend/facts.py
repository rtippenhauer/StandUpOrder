import json
import logging
import os
import re
import random
from datetime import date

import httpx

log = logging.getLogger("facts")
logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]

CACHE_FILE = "facts_cache.json"


async def get_daily_facts(data_path: str, _anthropic_key: str = "", target_date: date | None = None) -> dict:
    today = target_date or date.today()
    cache_path = os.path.join(data_path, CACHE_FILE)
    date_key = today.isoformat()

    # Multi-date cache: {date_key: facts_dict}
    cache: dict = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
            if date_key in cache:
                log.info("Returning cached facts for %s", today)
                return cache[date_key]
        except (json.JSONDecodeError, KeyError) as e:
            log.warning("Cache read failed: %s", e)
            cache = {}

    log.info("Fetching fresh facts for %s", today)
    facts: dict = {}

    facts["national_days"] = await _fetch_national_today(today)
    log.info("National days: %d items", len(facts["national_days"]))

    wiki = await _fetch_wikipedia(today)
    facts["on_this_day"] = wiki["on_this_day"]
    facts["famous_birthdays"] = wiki["famous_birthdays"]
    log.info("Wikipedia: %d events, %d birthdays",
             len(facts["on_this_day"]), len(facts["famous_birthdays"]))

    facts["fun_trivia"] = await _fetch_numbers_trivia(today)
    log.info("Trivia: %d items", len(facts["fun_trivia"]))

    if not any(facts.values()):
        log.warning("All API calls returned empty — using static fallback")
        facts = _static_fallback(today)

    # Store in multi-date cache
    cache[date_key] = facts
    # Keep cache from growing unbounded — drop entries older than 60 days
    cutoff = (today.replace(day=1) if today.day > 1 else today).isoformat()
    cache = {k: v for k, v in cache.items() if k >= str(today.year - 1)}

    try:
        tmp = cache_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
        os.replace(tmp, cache_path)
        log.info("Facts cached to %s", cache_path)
    except OSError as e:
        log.error("Cache write failed: %s", e)

    return facts


async def _fetch_national_today(today: date) -> list:
    """
    Fetch national days from nationaltoday.com.
    URL format: https://nationaltoday.com/june-1-holidays/
    Extracts h3 holiday links to individual holiday pages.
    """
    month_name = MONTHS[today.month - 1]
    url = f"https://nationaltoday.com/{month_name}-{today.day}-holidays/"
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "text/html",
                },
            )
        log.info("NationalToday status: %d for %s", resp.status_code, url)
        if resp.status_code != 200:
            return []

        text = resp.text
        days = []
        seen_names: set = set()

        # ── Strategy 1: meta description (most reliable) ──────────────────
        # Format: "Holiday1, Holiday2, and Holiday3 — every observance on May 31, 2026."
        meta_match = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{10,400})["\']',
            text, re.IGNORECASE
        )
        if not meta_match:
            meta_match = re.search(
                r'<meta[^>]+content=["\']([^"\']{10,400})["\'][^>]+name=["\']description["\']',
                text, re.IGNORECASE
            )
        if meta_match:
            desc = meta_match.group(1)
            # Strip the " — every observance..." suffix
            holidays_part = desc.split(' — ')[0] if ' — ' in desc else desc.split('.')[0]
            items = re.split(r',\s*|\s+and\s+', holidays_part)
            for item in items:
                item = item.strip().strip('.')
                lower = item.lower()
                if not item or len(item) < 4 or len(item) > 70:
                    continue
                if any(skip in lower for skip in ['birthday', 'observance', 'holiday', 'every']):
                    continue
                slug = re.sub(r"[^a-z0-9]+", '-', lower).strip('-')
                full_url = f"https://nationaltoday.com/{slug}/"
                if item not in seen_names:
                    seen_names.add(item)
                    days.append({"name": item, "url": full_url})

        # ── Strategy 2: h3 links from All Holidays section (more items) ───
        section_start = text.lower().find('all holidays on')
        if section_start == -1:
            section_start = text.lower().find('all holidays')
        if section_start != -1:
            search_text = text[section_start:section_start + 20000]
            # Stop before birthdays/upcoming sections
            for stop_marker in ['birthdays', 'upcoming holidays', 'more holidays']:
                stop_pos = search_text.lower().find(stop_marker)
                if stop_pos != -1 and stop_pos > 200:
                    search_text = search_text[:stop_pos]
                    break

            NAV_SLUGS = {'our-mission', 'promote-an-event', 'national-today-calendar',
                         'reminders', 'sign-up', 'login-page', 'birthdays', 'about'}

            # Simple non-DOTALL regex - matches h3 with inline link
            h3_re = re.compile(
                r'<h3[^>]{0,200}><a\s+href=["\']([^"\']+)["\'][^>]{0,100}>([^<]{3,70})</a>',
                re.IGNORECASE
            )
            for match in h3_re.finditer(search_text):
                href = match.group(1)
                name = match.group(2).strip()
                lower = name.lower()
                slug = href.strip('/')

                if slug in NAV_SLUGS:
                    continue
                if 'birthday' in lower or 'birthdays' in lower:
                    continue
                if re.match(r'^(january|february|march|april|may|june|july|august|september|october|november|december)', slug):
                    continue
                if name in seen_names:
                    continue

                if not href.startswith('http'):
                    href = 'https://nationaltoday.com' + href
                seen_names.add(name)
                days.append({"name": name, "url": href})
                if len(days) >= 12:
                    break

        log.info("National days parsed: %d", len(days))
        return days

    except Exception as e:
        log.warning("NationalToday fetch failed: %s", e)
        return []


async def _fetch_wikipedia(today: date) -> dict:
    """Wikipedia free On This Day API — no key required."""
    url = f"https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/{today.month:02d}/{today.day:02d}"
    empty = {"on_this_day": [], "famous_birthdays": []}
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={"User-Agent": "StandUpOrderGenerator/1.0", "Accept": "application/json"},
            )
        log.info("Wikipedia status: %d", resp.status_code)
        if resp.status_code != 200:
            return empty

        data = resp.json()

        raw_events = data.get("events", [])
        random.shuffle(raw_events)
        on_this_day = []
        for e in raw_events[:7]:
            text = e.get("text", "").strip()
            year = e.get("year")
            if text and year is not None:
                on_this_day.append({"year": year, "event": _truncate(text, 120)})

        raw_births = data.get("births", [])
        notable = [b for b in raw_births if b.get("pages")]
        random.shuffle(notable)
        famous_birthdays = []
        for b in notable[:7]:
            text = b.get("text", "").strip()
            year = b.get("year")
            pages = b.get("pages", [])
            known_for = ""
            if pages:
                desc = pages[0].get("description", "")
                known_for = _truncate(desc, 60) if desc else ""
            name = text.split(",")[0].strip() if text else ""
            if name and year is not None:
                famous_birthdays.append({"name": name, "birth_year": year, "known_for": known_for})

        return {"on_this_day": on_this_day, "famous_birthdays": famous_birthdays}

    except Exception as e:
        log.error("Wikipedia fetch failed: %s", e)
        return empty


async def _fetch_numbers_trivia(today: date) -> list:
    """numbersapi.com — free, no key. Falls back to Open Trivia DB."""
    try:
        url = f"http://numbersapi.com/{today.month}/{today.day}/date"
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(url, headers={"Accept": "text/plain"})
        log.info("Numbers API status: %d", resp.status_code)
        if resp.status_code == 200 and resp.text.strip():
            fact = resp.text.strip()
            if "is a number" not in fact and len(fact) > 20:
                return [fact]
    except Exception as e:
        log.warning("Numbers API failed: %s", e)

    # Fallback: Open Trivia DB
    try:
        url = "https://opentdb.com/api.php?amount=3&type=multiple&difficulty=easy&category=9"
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
        log.info("OpenTDB status: %d", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            trivia = []
            for r in data.get("results", [])[:3]:
                q = _strip_tags(r.get("question", "")).strip()
                a = _strip_tags(r.get("correct_answer", "")).strip()
                if q and a:
                    trivia.append(f"{q} — {a}")
            if trivia:
                return trivia
    except Exception as e:
        log.warning("OpenTDB failed: %s", e)

    return []


def _static_fallback(today: date) -> dict:
    month = today.strftime("%B")
    day = today.day
    return {
        "national_days": [],
        "on_this_day": [
            {"year": 1969, "event": "Apollo 11 landed on the Moon (July 20)"},
            {"year": 1989, "event": "The World Wide Web was proposed by Tim Berners-Lee"},
            {"year": 1903, "event": "The Wright Brothers made the first powered flight"},
        ],
        "famous_birthdays": [
            {"name": "Ada Lovelace", "birth_year": 1815, "known_for": "First computer programmer"},
            {"name": "Alan Turing", "birth_year": 1912, "known_for": "Father of computer science"},
        ],
        "fun_trivia": [
            f"Today is {month} {day}. Facts unavailable — check your container's internet access.",
        ],
    }


def _strip_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "…"
