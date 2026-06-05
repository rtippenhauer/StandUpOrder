"""
Google OAuth authentication with HTTP-only session cookies.
- Super admin: SUPER_ADMIN_EMAIL env var
- Team managers: stored per-team in settings, onboarded via invite links
- Sessions: HTTP-only signed cookies, 8hr expiry
- Public routes: read-only /team/{slug} data
"""
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_hex(32))
SUPER_ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "rtippenhauer@gmail.com")
SESSION_HOURS = 8

_signer = URLSafeTimedSerializer(SECRET_KEY)
COOKIE_NAME = "standup_session"


# ── Session cookie ────────────────────────────────────────────────────────

def create_session_cookie(email: str) -> str:
    """Return a signed session value to store in an HTTP-only cookie."""
    payload = {"email": email, "iat": datetime.utcnow().isoformat()}
    return _signer.dumps(payload)


def decode_session_cookie(value: str) -> Optional[str]:
    """Return email from cookie value, or None if invalid/expired."""
    try:
        payload = _signer.loads(value, max_age=SESSION_HOURS * 3600)
        return payload.get("email")
    except (BadSignature, SignatureExpired, Exception):
        return None


# ── Role checks ───────────────────────────────────────────────────────────

def is_super_admin(email: Optional[str]) -> bool:
    return bool(email) and email.lower() == SUPER_ADMIN_EMAIL.lower()


def can_manage_team(email: Optional[str], slug: str, team_store) -> bool:
    """Super admin can manage everything; team managers can manage their team."""
    if not email:
        return False
    if is_super_admin(email):
        return True
    return team_store.is_manager(slug, email)


# ── Invite tokens ─────────────────────────────────────────────────────────

def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def create_invite(slug: str, team_name: str, created_by: str, team_store, base_url: str) -> dict:
    token = generate_invite_token()
    expires_at = (datetime.utcnow() + timedelta(hours=48)).isoformat()
    invite = {
        "token": token,
        "team_slug": slug,
        "team_name": team_name,
        "created_by": created_by,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at,
        "used": False,
    }
    team_store.add_invite(invite)
    invite_url = f"{base_url}/invite/{token}"
    return {"invite": invite, "url": invite_url}


def get_valid_invite(token: str, team_store) -> Optional[dict]:
    """Return invite if valid and not expired/used."""
    inv = team_store.get_invite(token)
    if not inv:
        return None
    if inv.get("used"):
        return None
    if inv.get("expires_at") and inv["expires_at"] < datetime.utcnow().isoformat():
        return None
    return inv
