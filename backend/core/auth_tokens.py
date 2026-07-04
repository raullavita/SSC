"""JWT helpers for Engine 3 auth (session cookies ship in Engine 5)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from config import get_settings

TOKEN_TTL_HOURS = 24 * 7


def issue_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(hours=TOKEN_TTL_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None