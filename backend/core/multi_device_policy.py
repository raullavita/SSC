"""Multi-device policy — Engine 9."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

MAX_DEVICES_PER_USER = int(os.getenv("SSC_MAX_DEVICES_PER_USER", "5"))
LINK_TOKEN_TTL_MINUTES = int(os.getenv("SSC_LINK_TOKEN_TTL_MINUTES", "10"))


def new_link_token() -> str:
    return secrets.token_urlsafe(32)


def link_token_expires_at(now: datetime | None = None) -> datetime:
    base = now or datetime.now(timezone.utc)
    return base + timedelta(minutes=LINK_TOKEN_TTL_MINUTES)


def engine9_multi_device_ready() -> bool:
    return MAX_DEVICES_PER_USER >= 2