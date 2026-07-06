"""New-account DM cooldown — limits cold-DM spam from fresh signups (Tier D3)."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import HTTPException

from core.rate_limit import RateLimiter

NEW_ACCOUNT_GRACE_HOURS = int(os.getenv("SSC_NEW_ACCOUNT_GRACE_HOURS", "24"))
NEW_ACCOUNT_DM_LIMIT = int(os.getenv("SSC_NEW_ACCOUNT_DM_LIMIT", "10"))
NEW_ACCOUNT_DM_WINDOW_SEC = int(os.getenv("SSC_NEW_ACCOUNT_DM_WINDOW_SEC", "3600"))

new_account_dm_limiter = RateLimiter(
    "new_account_dm",
    NEW_ACCOUNT_DM_LIMIT,
    NEW_ACCOUNT_DM_WINDOW_SEC,
)


def _account_age_hours(user: dict, now: datetime | None = None) -> float | None:
    created = user.get("created_at")
    if not created:
        return None
    if not isinstance(created, datetime):
        return None
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    now = now or datetime.now(timezone.utc)
    return (now - created).total_seconds() / 3600.0


def is_new_account(user: dict, now: datetime | None = None) -> bool:
    age = _account_age_hours(user, now)
    if age is None:
        return False
    return age < NEW_ACCOUNT_GRACE_HOURS


async def enforce_new_account_dm(db, user_id: str, conversation: dict) -> None:
    """Raise 429 when a young account exceeds direct-message cooldown."""
    if conversation.get("type") != "direct":
        return

    user = await db.users.find_one({"_id": user_id})
    if not user or not is_new_account(user):
        return

    key = f"new_dm:{user_id}"
    if not await new_account_dm_limiter.allow(key):
        raise HTTPException(status_code=429, detail="new_account_dm_cooldown")