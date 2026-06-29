"""SFU join tokens — short-lived JWT for mediasoup room access."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from core.config import JWT_SECRET

SFU_TOKEN_TTL_MINUTES = 10


def make_sfu_join_token(user_id: str, room_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "room_id": room_id,
        "purpose": "sfu",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=SFU_TOKEN_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")