"""Centralized session TTL — Engine 5 single source of truth."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

DEFAULT_SESSION_TTL_HOURS = int(os.getenv("SSC_SESSION_TTL_HOURS", str(24 * 7)))


def session_ttl_hours() -> int:
    return DEFAULT_SESSION_TTL_HOURS


def jwt_expiry_delta() -> timedelta:
    return timedelta(hours=session_ttl_hours())


def session_expires_at(now: datetime | None = None) -> datetime:
    base = now or datetime.now(timezone.utc)
    return base + jwt_expiry_delta()


def mongo_ttl_index_seconds() -> int:
    """expireAfterSeconds=0 on expires_at field."""
    return 0