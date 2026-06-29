"""Signed activation tokens for password-register email verification."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from core.config import JWT_SECRET
from core.email_verification_policy import EMAIL_VERIFY_TOKEN_TTL_HOURS

PURPOSE = "email_verify"


def make_email_verification_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email.lower(),
        "purpose": PURPOSE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=EMAIL_VERIFY_TOKEN_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_email_verification_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None
    if payload.get("purpose") != PURPOSE:
        return None
    if not payload.get("sub") or not payload.get("email"):
        return None
    return payload