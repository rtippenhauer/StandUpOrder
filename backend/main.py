import os
import sys
from contextlib import asynccontextmanager
from datetime import date as date_type

sys.path.insert(0, os.path.dirname(__file__))

import httpx
import uvicorn
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from facts import get_daily_facts
from holidays import workdays_from, get_us_holidays
from models import PodCreate, PersonCreate, PersonUpdate, SessionLogEntry, SettingsUpdate
from oauth import (
    COOKIE_NAME, SUPER_ADMIN_EMAIL,
    create_session_cookie, decode_session_cookie,
    is_super_admin, can_manage_team,
    create_invite, get_valid_invite,
)
from session_log import append_session_log
from team_store import TeamStore, validate_slug
from timeoff import (
    load_timeoff, save_timeoff, get_out_today, get_out_on,
    load_entries, add_manual_entry, delete_entry, import_adp_entries,
    parse_adp_pdf, match_names,
)

DATA_PATH = os.environ.get("DATA_PATH", "/data")
PORT = int(os.environ.get("PORT", 8080))
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

store = TeamStore(DATA_PATH)

SESSION_MAX_AGE = 8 * 3600  # seconds


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.initialize()
    yield


app = FastAPI(title="Stand-Up Order Generator", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ── Auth dependencies ─────────────────────────────────────────────────────

def get_current_user(standup_session: Optional[str] = Cookie(default=None)) -> Optional[str]:
    """Return email from session cookie, or None."""
    if not standup_session:
        return None
    return decode_session_cookie(standup_session)


def require_super_admin(email: Optional[str] = Depends(get_current_user)):
    if not is_super_admin(email):
        raise HTTPException(403, "Super admin required")
    return email


def require_team_manager(slug: str, email: Optional[str] = Depends(get_current_user)):
    """FastAPI dependency — use require_team_access(slug) instead for path params."""
    if not can_manage_team(email, slug, store):
        raise HTTPException(403, "Team manager access required")
    return email


def _team_auth(slug: str, email: Optional[str]) -> str:
    """Check team manager access and return email."""
    if not store.team_exists(slug):
        raise HTTPException(404, f"Team '{slug}' not found")
    if not can_manage_team(email, slug, store):
        raise HTTPException(403, "Not authorized for this team")
    return email


def _team_exists(slug: str):
    if not store.team_exists(slug):
        raise HTTPException(404, f"Team '{slug}' not found")


# ── Google OAuth ──────────────────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@app.get("/api/auth/login")
async def google_login(request: Request, next: Optional[str] = None, invite: Optional[str] = None):
    """Redirect to Google OAuth."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET")

    # Encode next/invite into state
    state_parts = []
    if next:
        state_parts.append(f"next={next}")
    if invite:
        state_parts.append(f"invite={invite}")
    state = "&".join(state_parts) if state_parts else "none"

    redirect_uri = f"{BASE_URL}/api/auth/callback"
    params = (
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid email profile"
        f"&state={state}"
        f"&access_type=online"
        f"&prompt=select_account"
    )
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")


@app.get("/api/auth/callback")
async def google_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """Google OAuth callback — exchange code for tokens, set cookie."""
    if error:
        return RedirectResponse(f"/?auth_error={error}")
    if not code:
        return RedirectResponse("/?auth_error=missing_code")

    redirect_uri = f"{BASE_URL}/api/auth/callback"

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        try:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            })
            token_resp.raise_for_status()
            tokens = token_resp.json()

            userinfo_resp = await client.get(GOOGLE_USERINFO_URL, headers={
                "Authorization": f"Bearer {tokens['access_token']}"
            })
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()
        except Exception as e:
            return RedirectResponse(f"/?auth_error=oauth_failed")

    email = userinfo.get("email", "").lower().strip()
    if not email:
        return RedirectResponse("/?auth_error=no_email")

    # Parse state for invite token / next URL
    invite_token = None
    next_url = "/"
    if state and state != "none":
        for part in state.split("&"):
            if part.startswith("next="):
                next_url = part[5:] or "/"
            elif part.startswith("invite="):
                invite_token = part[7:] or None

    # Handle invite flow
    if invite_token:
        inv = get_valid_invite(invite_token, store)
        if inv:
            slug = inv["team_slug"]
            store.add_manager(slug, email)
            store.consume_invite(invite_token)
            next_url = f"/team/{slug}"
        else:
            # Still log them in but redirect to error
            next_url = "/?invite_error=invalid_or_expired"

    # Set session cookie
    session_val = create_session_cookie(email)
    response = RedirectResponse(next_url)
    response.set_cookie(
        COOKIE_NAME,
        session_val,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=BASE_URL.startswith("https://"),
    )
    return response


@app.post("/api/auth/logout")
async def logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME)
    return response


@app.get("/api/auth/me")
async def auth_me(email: Optional[str] = Depends(get_current_user)):
    if not email:
        return {"authenticated": False, "email": None, "is_super_admin": False, "teams": []}

    # Find which teams this user manages
    managed_teams = []
    for team in store.list_teams():
        slug = team["slug"]
        if is_super_admin(email) or store.is_manager(slug, email):
            managed_teams.append(slug)

    return {
        "authenticated": True,
        "email": email,
        "is_super_admin": is_super_admin(email),
        "teams": managed_teams,
    }


# ── Teams (super admin) ───────────────────────────────────────────────────

@app.get("/api/teams")
async def list_teams():
    """Public — list all teams for navigation."""
    return store.list_teams()


@app.post("/api/teams", status_code=201)
async def create_team_route(body: dict, email: str = Depends(require_super_admin)):
    slug = body.get("slug", "").strip().lower()
    name = body.get("name", "").strip()
    if not slug or not name:
        raise HTTPException(400, "slug and name required")
    try:
        team = store.create_team(slug, name)
        return team
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.put("/api/teams/{slug}")
async def update_team_route(slug: str, body: dict, email: str = Depends(require_super_admin)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "name required")
    try:
        return store.update_team(slug, name)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.delete("/api/teams/{slug}")
async def delete_team_route(slug: str, email: str = Depends(require_super_admin)):
    try:
        store.delete_team(slug)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(404, str(e))


# ── Invites ───────────────────────────────────────────────────────────────

@app.post("/api/teams/{slug}/invites")
async def create_invite_route(slug: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    team = store.get_team(slug)
    result = create_invite(slug, team["name"], email, store, BASE_URL)
    return result


@app.get("/api/teams/{slug}/invites")
async def list_invites(slug: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    invites = [i for i in store.load_invites() if i.get("team_slug") == slug]
    return invites


@app.delete("/api/teams/{slug}/invites/{token}")
async def revoke_invite_route(slug: str, token: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    if not store.revoke_invite(token):
        raise HTTPException(404, "Invite not found")
    return {"ok": True}


@app.get("/api/invites/{token}")
async def get_invite_info(token: str):
    """Public — get invite info before login (so UI can show team name)."""
    inv = get_valid_invite(token, store)
    if not inv:
        raise HTTPException(404, "Invite not found or expired")
    return {"team_slug": inv["team_slug"], "team_name": inv["team_name"]}


# ── Team managers ─────────────────────────────────────────────────────────

@app.get("/api/teams/{slug}/managers")
async def get_team_managers(slug: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    return {"managers": store.get_managers(slug)}


@app.delete("/api/teams/{slug}/managers/{manager_email}")
async def remove_team_manager(slug: str, manager_email: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    store.remove_manager(slug, manager_email)
    return {"ok": True}


# ── Team settings ─────────────────────────────────────────────────────────

@app.get("/api/team/{slug}/settings")
async def get_settings(slug: str):
    """Public read."""
    _team_exists(slug)
    data = store.load_settings(slug)
    # Don't expose internal fields publicly
    safe = {k: v for k, v in data.items() if k not in ("users", "managers")}
    return safe


@app.patch("/api/team/{slug}/settings")
async def patch_settings(slug: str, updates: SettingsUpdate, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    data.update(updates.model_dump(exclude_none=True))
    store.save_settings(slug, data)
    return {"ok": True}


# ── Pods ──────────────────────────────────────────────────────────────────

@app.get("/api/team/{slug}/pods")
async def get_pods(slug: str):
    _team_exists(slug)
    return store.load_settings(slug).get("pods", {})


@app.post("/api/team/{slug}/pods", status_code=201)
async def create_pod(slug: str, pod: PodCreate, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    pods = data.setdefault("pods", {})
    n = len(pods) + 1
    while f"pod_{n}" in pods:
        n += 1
    pod_id = f"pod_{n}"
    pods[pod_id] = {"name": pod.name, "abbreviation": pod.abbreviation or pod.name[:4].upper()}
    store.save_settings(slug, data)
    return {"pod_id": pod_id, **pods[pod_id]}


@app.put("/api/team/{slug}/pods/{pod_id}")
async def update_pod(slug: str, pod_id: str, pod: PodCreate, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    if pod_id not in data.get("pods", {}):
        raise HTTPException(404, "Pod not found")
    data["pods"][pod_id] = {"name": pod.name, "abbreviation": pod.abbreviation or pod.name[:4].upper()}
    store.save_settings(slug, data)
    return {"ok": True}


@app.delete("/api/team/{slug}/pods/{pod_id}")
async def delete_pod(slug: str, pod_id: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    if pod_id not in data.get("pods", {}):
        raise HTTPException(404, "Pod not found")
    del data["pods"][pod_id]
    for name in data.get("people_groups", {}):
        if pod_id in data["people_groups"][name]:
            data["people_groups"][name].remove(pod_id)
    if data.get("default_pod") == pod_id:
        remaining = list(data["pods"].keys())
        data["default_pod"] = remaining[0] if remaining else None
    store.save_settings(slug, data)
    return {"ok": True}


# ── People ────────────────────────────────────────────────────────────────

@app.get("/api/team/{slug}/people")
async def get_people(slug: str):
    _team_exists(slug)
    return store.load_settings(slug).get("people_groups", {})


@app.post("/api/team/{slug}/people", status_code=201)
async def create_person(slug: str, person: PersonCreate, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    people = data.setdefault("people_groups", {})
    if person.name in people:
        raise HTTPException(400, "Person already exists")
    people[person.name] = person.pod_ids or []
    store.save_settings(slug, data)
    return {"ok": True}


@app.put("/api/team/{slug}/people/{name}")
async def update_person(slug: str, name: str, update: PersonUpdate, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    people = data.get("people_groups", {})
    if name not in people:
        raise HTTPException(404, "Person not found")
    current_pods = people[name]
    del people[name]
    new_name = update.new_name if update.new_name else name
    people[new_name] = update.pod_ids if update.pod_ids is not None else current_pods
    store.save_settings(slug, data)
    return {"ok": True}


@app.delete("/api/team/{slug}/people/{name}")
async def delete_person(slug: str, name: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    if name not in data.get("people_groups", {}):
        raise HTTPException(404, "Person not found")
    del data["people_groups"][name]
    store.save_settings(slug, data)
    return {"ok": True}


# ── Facts ─────────────────────────────────────────────────────────────────

@app.get("/api/team/{slug}/facts")
async def get_facts(slug: str, date: Optional[str] = None):
    _team_exists(slug)
    try:
        team_data_path = store.team_path(slug)
        target = date_type.fromisoformat(date) if date else None
        return await get_daily_facts(team_data_path, target_date=target)
    except Exception:
        return {"national_days": [], "on_this_day": [], "famous_birthdays": [], "fun_trivia": []}


# ── Session Log ───────────────────────────────────────────────────────────

@app.post("/api/team/{slug}/session/log")
async def log_session(slug: str, entry: SessionLogEntry):
    _team_exists(slug)
    try:
        append_session_log(store.team_path(slug), entry.model_dump())
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    return {"ok": True}


# ── Time Off ──────────────────────────────────────────────────────────────

def _team_data(slug: str) -> str:
    _team_exists(slug)
    return store.team_path(slug)


@app.get("/api/team/{slug}/timeoff")
async def get_timeoff(slug: str):
    return load_timeoff(_team_data(slug))


@app.get("/api/team/{slug}/timeoff/today")
async def get_timeoff_today(slug: str):
    return {"out": get_out_today(_team_data(slug))}


@app.get("/api/team/{slug}/timeoff/on/{date_str}")
async def get_timeoff_on(slug: str, date_str: str):
    try:
        d = date_type.fromisoformat(date_str)
        return {"out": get_out_on(_team_data(slug), d)}
    except ValueError:
        raise HTTPException(400, "Invalid date")


@app.get("/api/team/{slug}/timeoff/entries")
async def get_entries(slug: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    return load_entries(_team_data(slug))


@app.post("/api/team/{slug}/timeoff/entries")
async def add_entry(slug: str, body: dict, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    try:
        start = date_type.fromisoformat(body["start_date"])
        entry = add_manual_entry(
            _team_data(slug),
            name=body["name"],
            start_date=start,
            num_days=int(body["num_days"]),
            note=body.get("note", ""),
        )
        return entry
    except (KeyError, ValueError) as e:
        raise HTTPException(400, str(e))


@app.delete("/api/team/{slug}/timeoff/entries/{entry_id}")
async def remove_entry(slug: str, entry_id: str, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    if not delete_entry(_team_data(slug), entry_id):
        raise HTTPException(404, "Entry not found")
    return {"ok": True}


@app.get("/api/team/{slug}/timeoff/calculate")
async def calculate_workdays(slug: str, start_date: str, num_days: int):
    _team_exists(slug)
    try:
        start = date_type.fromisoformat(start_date)
        days = workdays_from(start, num_days)
        return {"workdays": [d.isoformat() for d in days], "end_date": days[-1].isoformat() if days else start_date}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/team/{slug}/holidays/{year}")
async def get_holidays(slug: str, year: int):
    _team_exists(slug)
    return {"holidays": sorted(d.isoformat() for d in get_us_holidays(year))}


@app.put("/api/team/{slug}/timeoff")
async def save_timeoff_route(slug: str, schedule: dict, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    save_timeoff(_team_data(slug), schedule)
    return {"ok": True}


@app.post("/api/team/{slug}/timeoff/parse-pdf")
async def parse_timeoff_pdf(slug: str, file: UploadFile = File(...), email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    try:
        pdf_bytes = await file.read()
        entries = parse_adp_pdf(pdf_bytes)
        data = store.load_settings(slug)
        roster = list(data.get("people_groups", {}).keys())
        adp_name_map = data.get("adp_name_map", {})
        matched = match_names(entries, roster, adp_name_map)
        return {"entries": matched, "roster": roster}
    except RuntimeError as e:
        raise HTTPException(400, str(e))


@app.post("/api/team/{slug}/timeoff/save-name-map")
async def save_name_map(slug: str, mapping: dict, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    data = store.load_settings(slug)
    existing = data.get("adp_name_map", {})
    existing.update(mapping)
    data["adp_name_map"] = existing
    store.save_settings(slug, data)
    return {"ok": True}


@app.post("/api/team/{slug}/timeoff/import-adp")
async def import_adp(slug: str, body: dict, email: Optional[str] = Depends(get_current_user)):
    _team_auth(slug, email)
    entries = body.get("entries", [])
    count = import_adp_entries(_team_data(slug), entries)
    return {"ok": True, "imported": count}


# ── Shared utils (no team context) ───────────────────────────────────────

@app.get("/api/holidays/{year}")
async def get_holidays_global(year: int):
    return {"holidays": sorted(d.isoformat() for d in get_us_holidays(year))}


@app.get("/api/timeoff/calculate")
async def calculate_workdays_global(start_date: str, num_days: int):
    try:
        start = date_type.fromisoformat(start_date)
        days = workdays_from(start, num_days)
        return {"workdays": [d.isoformat() for d in days], "end_date": days[-1].isoformat() if days else start_date}
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Frontend SPA ──────────────────────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
