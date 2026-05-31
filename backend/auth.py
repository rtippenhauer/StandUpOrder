"""Simple token-based auth with bcrypt password hashing."""
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt

_tokens: dict[str, dict] = {}
TOKEN_TTL_HOURS = 8


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(username: str) -> str:
    token = secrets.token_urlsafe(32)
    _tokens[token] = {
        "username": username,
        "expires": datetime.now() + timedelta(hours=TOKEN_TTL_HOURS),
    }
    _cleanup()
    return token


def verify_token(token: str) -> Optional[str]:
    """Return username if token is valid, else None."""
    entry = _tokens.get(token)
    if not entry:
        return None
    if entry["expires"] < datetime.now():
        del _tokens[token]
        return None
    return entry["username"]


def revoke_token(token: str):
    _tokens.pop(token, None)


def _cleanup():
    """Remove expired tokens."""
    now = datetime.now()
    expired = [t for t, e in _tokens.items() if e["expires"] < now]
    for t in expired:
        del _tokens[t]
