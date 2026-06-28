"""Retention helpers — Engine 1 Step 1.3 TTL enforcement."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.utils import iso, now_utc

DEFAULT_RETENTION_HOURS = 24
DEFAULT_FRIEND_REQUEST_PENDING_DAYS = 7


def retention_hours() -> int:
    raw = (os.environ.get("SSC_RETENTION_HOURS") or str(DEFAULT_RETENTION_HOURS)).strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = DEFAULT_RETENTION_HOURS
    return max(1, min(hours, 24 * 30))


def friend_request_pending_days() -> int:
    raw = (os.environ.get("SSC_FRIEND_REQUEST_PENDING_DAYS") or str(DEFAULT_FRIEND_REQUEST_PENDING_DAYS)).strip()
    try:
        days = int(raw)
    except ValueError:
        days = DEFAULT_FRIEND_REQUEST_PENDING_DAYS
    return max(1, min(days, 30))


def expires_at_from_now(hours: Optional[int] = None) -> datetime:
    h = retention_hours() if hours is None else hours
    return now_utc() + timedelta(hours=h)


def friend_request_pending_expires_at() -> datetime:
    return now_utc() + timedelta(days=friend_request_pending_days())


def friend_request_resolved_expires_at() -> datetime:
    return expires_at_from_now()


def conversation_activity_fields(at: Optional[datetime] = None, hours: Optional[int] = None) -> dict:
    """Fields for new conversations or activity bumps (expires_at is BSON date for TTL)."""
    ts = at or now_utc()
    return {
        "last_activity_at": iso(ts),
        "expires_at": expires_at_from_now(hours),
    }


def message_read_expiry_fields(hours: Optional[int] = None) -> dict:
    return {"expires_at": expires_at_from_now(hours)}


# Collections that must have a Mongo TTL index on expires_at (Engine 1.3)
TTL_INDEX_COLLECTIONS = (
    "messages",
    "files",
    "calls",
    "user_sessions",
    "statuses",
    "conversations",
    "message_reads",
    "message_reactions",
    "friend_requests",
)