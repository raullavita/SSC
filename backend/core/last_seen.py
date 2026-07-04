"""Last-seen privacy — coarse buckets, opt-in — Engine 4."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

ONLINE_WINDOW = timedelta(minutes=5)
RECENTLY_WINDOW = timedelta(hours=24)


def default_privacy_settings() -> dict[str, bool]:
    return {
        "last_seen_visible": False,
        "read_receipts": False,
    }


def coarse_last_seen(last_active: datetime | None, visible: bool) -> str:
    if not visible:
        return "hidden"
    if last_active is None:
        return "hidden"
    now = datetime.now(timezone.utc)
    if last_active.tzinfo is None:
        last_active = last_active.replace(tzinfo=timezone.utc)
    delta = now - last_active
    if delta <= ONLINE_WINDOW:
        return "online"
    if delta <= RECENTLY_WINDOW:
        return "recently"
    return "away"


async def record_user_activity(db, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"last_active": now}},
    )


async def privacy_map_for_users(db, user_ids: list[str]) -> dict[str, dict[str, bool]]:
    result: dict[str, dict[str, bool]] = {}
    if not user_ids:
        return result
    cursor = db.users.find({"_id": {"$in": user_ids}}, {"privacy_settings": 1})
    async for doc in cursor:
        settings = doc.get("privacy_settings") or default_privacy_settings()
        result[doc["_id"]] = settings
    return result


async def last_seen_for_viewer(
    db,
    subject_id: str,
    viewer_id: str,
    privacy_map: dict[str, dict[str, bool]] | None = None,
) -> dict[str, Any]:
    if subject_id == viewer_id:
        return {"user_id": subject_id, "bucket": "online", "visible": True}

    pmap = privacy_map or await privacy_map_for_users(db, [subject_id])
    settings = pmap.get(subject_id, default_privacy_settings())
    visible = bool(settings.get("last_seen_visible", False))

    user = await db.users.find_one({"_id": subject_id}, {"last_active": 1})
    last_active = user.get("last_active") if user else None
    bucket = coarse_last_seen(last_active, visible)
    return {"user_id": subject_id, "bucket": bucket, "visible": visible}