"""Multi-device policy — Engine 9."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

MAX_DEVICES_PER_USER = int(os.getenv("SSC_MAX_DEVICES_PER_USER", "5"))
LINK_TOKEN_TTL_MINUTES = int(os.getenv("SSC_LINK_TOKEN_TTL_MINUTES", "10"))
LINK_DEEP_LINK_SCHEME = "ssc://link-device"


def new_link_token() -> str:
    return secrets.token_urlsafe(32)


def link_token_expires_at(now: datetime | None = None) -> datetime:
    base = now or datetime.now(timezone.utc)
    return base + timedelta(minutes=LINK_TOKEN_TTL_MINUTES)


def link_ttl_seconds() -> int:
    return LINK_TOKEN_TTL_MINUTES * 60


def build_device_link_path(token: str) -> str:
    from urllib.parse import quote

    return f"/link-device?token={quote(token, safe='')}"


def build_device_link_deep_link(token: str) -> str:
    from urllib.parse import quote

    return f"{LINK_DEEP_LINK_SCHEME}?token={quote(token, safe='')}"


def public_linked_device(doc: dict) -> dict:
    return {
        "id": doc.get("device_id"),
        "name": doc.get("name"),
        "platform": doc.get("platform"),
    }


def step15_multi_device_polish_ready() -> bool:
    return bool(LINK_DEEP_LINK_SCHEME) and link_ttl_seconds() > 0


def engine9_multi_device_ready() -> bool:
    return MAX_DEVICES_PER_USER >= 2 and step15_multi_device_polish_ready()