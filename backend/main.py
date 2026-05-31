import os
import sys
from contextlib import asynccontextmanager
from datetime import date as date_type

sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from auth import hash_password, verify_password, create_token, verify_token, revoke_token
from facts import get_daily_facts
from holidays import workdays_from, get_us_holidays
from models import PodCreate, PersonCreate, PersonUpdate, SessionLogEntry, SettingsUpdate
from session_log import append_session_log
from settings_store import SettingsStore
from timeoff import (
    load_timeoff, save_timeoff, get_out_today, get_out_on,
    load_entries, add_manual_entry, delete_entry, import_adp_entries,
    parse_adp_pdf, match_names,
)

DATA_PATH = os.environ.get("DATA_PATH", "/data")
PORT = int(os.environ.get("PORT", 8080))
store = SettingsStore(DATA_PATH)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.initialize()
    yield


app = FastAPI(title="Stand-Up Order Generator", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Auth dependency ───────────────────────────────────────────────────────

def require_auth(authorization: str = Header(default=None)):
    """Dependency that enforces auth IF users exist. If no users, open access."""
    data = store.load()
    users = data.get("users", [])
    if not users:
        return "setup"  # No users yet — open access for first-run setup
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.replace("Bearer ", "").strip()
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return username


# ── Auth routes ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str


@app.get("/api/auth/status")
async def auth_status():
    data = store.load()
    users = data.get("users", [])
    return {"has_users": len(users) > 0, "usernames": [u["username"] for u in users]}


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    data = store.load()
    users = data.get("users", [])
    for user in users:
        if user["username"] == req.username:
            if verify_password(req.password, user["password_hash"]):
                token = create_token(req.username)
                return {"token": token, "username": req.username}
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/api/auth/logout")
async def logout(authorization: str = Header(default=None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        revoke_token(token)
    return {"ok": True}


# ── User management ───────────────────────────────────────────────────────

@app.get("/api/users")
async def get_users(_user: str = Depends(require_auth)):
    data = store.load()
    users = data.get("users", [])
    return [{"username": u["username"]} for u in users]


@app.post("/api/users", status_code=201)
async def create_user(req: CreateUserRequest, _user: str = Depends(require_auth)):
    data = store.load()
    users = data.setdefault("users", [])
    if any(u["username"] == req.username for u in users):
        raise HTTPException(400, "Username already exists")
    users.append({"username": req.username, "password_hash": hash_password(req.password)})
    store.save(data)
    return {"ok": True}


@app.put("/api/users/{username}")
async def update_user_password(username: str, req: CreateUserRequest, _user: str = Depends(require_auth)):
    data = store.load()
    users = data.get("users", [])
    for user in users:
        if user["username"] == username:
            user["password_hash"] = hash_password(req.password)
            store.save(data)
            return {"ok": True}
    raise HTTPException(404, "User not found")


@app.delete("/api/users/{username}")
async def delete_user(username: str, _user: str = Depends(require_auth)):
    data = store.load()
    users = data.get("users", [])
    data["users"] = [u for u in users if u["username"] != username]
    store.save(data)
    return {"ok": True}


# ── Settings ──────────────────────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings():
    return store.load()


@app.patch("/api/settings")
async def patch_settings(updates: SettingsUpdate, _user: str = Depends(require_auth)):
    data = store.load()
    data.update(updates.model_dump(exclude_none=True))
    store.save(data)
    return {"ok": True}


# ── Pods ──────────────────────────────────────────────────────────────────

@app.get("/api/pods")
async def get_pods():
    return store.load().get("pods", {})


@app.post("/api/pods", status_code=201)
async def create_pod(pod: PodCreate, _user: str = Depends(require_auth)):
    data = store.load()
    pods = data.setdefault("pods", {})
    n = len(pods) + 1
    while f"pod_{n}" in pods:
        n += 1
    pod_id = f"pod_{n}"
    pods[pod_id] = {"name": pod.name, "abbreviation": pod.abbreviation or pod.name[:4].upper()}
    store.save(data)
    return {"pod_id": pod_id, **pods[pod_id]}


@app.put("/api/pods/{pod_id}")
async def update_pod(pod_id: str, pod: PodCreate, _user: str = Depends(require_auth)):
    data = store.load()
    if pod_id not in data.get("pods", {}):
        raise HTTPException(404, "Pod not found")
    data["pods"][pod_id] = {"name": pod.name, "abbreviation": pod.abbreviation or pod.name[:4].upper()}
    store.save(data)
    return {"ok": True}


@app.delete("/api/pods/{pod_id}")
async def delete_pod(pod_id: str, _user: str = Depends(require_auth)):
    data = store.load()
    if pod_id not in data.get("pods", {}):
        raise HTTPException(404, "Pod not found")
    del data["pods"][pod_id]
    for name in data.get("people_groups", {}):
        if pod_id in data["people_groups"][name]:
            data["people_groups"][name].remove(pod_id)
    if data.get("default_pod") == pod_id:
        remaining = list(data["pods"].keys())
        data["default_pod"] = remaining[0] if remaining else None
    store.save(data)
    return {"ok": True}


# ── People ────────────────────────────────────────────────────────────────

@app.get("/api/people")
async def get_people():
    return store.load().get("people_groups", {})


@app.post("/api/people", status_code=201)
async def create_person(person: PersonCreate, _user: str = Depends(require_auth)):
    data = store.load()
    people = data.setdefault("people_groups", {})
    if person.name in people:
        raise HTTPException(400, "Person already exists")
    people[person.name] = person.pod_ids or []
    store.save(data)
    return {"ok": True}


@app.put("/api/people/{name}")
async def update_person(name: str, update: PersonUpdate, _user: str = Depends(require_auth)):
    data = store.load()
    people = data.get("people_groups", {})
    if name not in people:
        raise HTTPException(404, "Person not found")
    current_pods = people[name]
    del people[name]
    new_name = update.new_name if update.new_name else name
    people[new_name] = update.pod_ids if update.pod_ids is not None else current_pods
    store.save(data)
    return {"ok": True}


@app.delete("/api/people/{name}")
async def delete_person(name: str, _user: str = Depends(require_auth)):
    data = store.load()
    if name not in data.get("people_groups", {}):
        raise HTTPException(404, "Person not found")
    del data["people_groups"][name]
    store.save(data)
    return {"ok": True}


# ── Facts ─────────────────────────────────────────────────────────────────

@app.get("/api/facts")
async def get_facts(date: Optional[str] = None):
    try:
        target = date_type.fromisoformat(date) if date else None
        return await get_daily_facts(DATA_PATH, target_date=target)
    except Exception:
        return {"national_days": [], "on_this_day": [], "famous_birthdays": [], "fun_trivia": []}


# ── Session Log ───────────────────────────────────────────────────────────

@app.post("/api/session/log")
async def log_session(entry: SessionLogEntry):
    try:
        append_session_log(DATA_PATH, entry.model_dump())
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    return {"ok": True}


# ── Time Off ──────────────────────────────────────────────────────────────

@app.get("/api/timeoff")
async def get_timeoff():
    return load_timeoff(DATA_PATH)


@app.get("/api/timeoff/today")
async def get_timeoff_today():
    return {"out": get_out_today(DATA_PATH)}


@app.get("/api/timeoff/on/{date_str}")
async def get_timeoff_on(date_str: str):
    try:
        d = date_type.fromisoformat(date_str)
        return {"out": get_out_on(DATA_PATH, d)}
    except ValueError:
        raise HTTPException(400, "Invalid date")


@app.get("/api/timeoff/entries")
async def get_entries(_user: str = Depends(require_auth)):
    return load_entries(DATA_PATH)


@app.post("/api/timeoff/entries")
async def add_entry(body: dict, _user: str = Depends(require_auth)):
    try:
        start = date_type.fromisoformat(body["start_date"])
        entry = add_manual_entry(
            DATA_PATH,
            name=body["name"],
            start_date=start,
            num_days=int(body["num_days"]),
            note=body.get("note", ""),
        )
        return entry
    except (KeyError, ValueError) as e:
        raise HTTPException(400, str(e))


@app.delete("/api/timeoff/entries/{entry_id}")
async def remove_entry(entry_id: str, _user: str = Depends(require_auth)):
    if not delete_entry(DATA_PATH, entry_id):
        raise HTTPException(404, "Entry not found")
    return {"ok": True}


@app.get("/api/timeoff/calculate")
async def calculate_workdays(start_date: str, num_days: int):
    try:
        start = date_type.fromisoformat(start_date)
        days = workdays_from(start, num_days)
        return {
            "workdays": [d.isoformat() for d in days],
            "end_date": days[-1].isoformat() if days else start_date,
        }
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/holidays/{year}")
async def get_holidays(year: int):
    holidays = get_us_holidays(year)
    return {"holidays": sorted(d.isoformat() for d in holidays)}


@app.put("/api/timeoff")
async def save_timeoff_route(schedule: dict, _user: str = Depends(require_auth)):
    save_timeoff(DATA_PATH, schedule)
    return {"ok": True}


@app.post("/api/timeoff/parse-pdf")
async def parse_timeoff_pdf(file: UploadFile = File(...), _user: str = Depends(require_auth)):
    try:
        pdf_bytes = await file.read()
        entries = parse_adp_pdf(pdf_bytes)
        data = store.load()
        roster = list(data.get("people_groups", {}).keys())
        adp_name_map = data.get("adp_name_map", {})
        matched = match_names(entries, roster, adp_name_map)
        return {"entries": matched, "roster": roster}
    except RuntimeError as e:
        raise HTTPException(400, str(e))


@app.post("/api/timeoff/save-name-map")
async def save_name_map(mapping: dict, _user: str = Depends(require_auth)):
    data = store.load()
    existing = data.get("adp_name_map", {})
    existing.update(mapping)
    data["adp_name_map"] = existing
    store.save(data)
    return {"ok": True}


@app.post("/api/timeoff/import-adp")
async def import_adp(body: dict, _user: str = Depends(require_auth)):
    entries = body.get("entries", [])
    count = import_adp_entries(DATA_PATH, entries)
    return {"ok": True, "imported": count}


# ── Frontend SPA ──────────────────────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
