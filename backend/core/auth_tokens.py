"""JWT helpers — TTL from session_ttl module (Engine 5)."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

import jwt

from config import get_settings
from core.session_policy import SESSION_JWT_TYPE
from core.session_ttl import session_expires_at


def issue_access_token(user_id: str, jti: str | None = None) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    session_jti = jti or secrets.token_hex(16)
    payload = {
        "sub": user_id,
        "jti": session_jti,
        "iat": now,
        "exp": session_expires_at(now),
        "type": SESSION_JWT_TYPE,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None