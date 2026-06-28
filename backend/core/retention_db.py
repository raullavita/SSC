"""Database-side retention: activity bumps and backfill for legacy rows."""
from datetime import datetime, timedelta, timezone

from core.database import db
from core.logging_config import logger
from core.retention import (
    conversation_activity_fields,
    expires_at_from_now,
    friend_request_pending_days,
    message_read_expiry_fields,
    retention_hours,
)
from core.user_retention import effective_retention_hours, user_retention_hours_from_doc
from core.utils import iso, now_utc


async def effective_retention_for_user_ids(user_ids: list[str]) -> int:
    if not user_ids:
        return retention_hours()
    cur = db.users.find({"user_id": {"$in": user_ids}}, {"retention_hours": 1, "_id": 0})
    hours_list = [user_retention_hours_from_doc(doc) async for doc in cur]
    return effective_retention_hours(hours_list)


async def get_effective_retention_for_conversation(conversation_id: str) -> int:
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id},
        {"participants": 1, "_id": 0},
    )
    if not conv:
        return retention_hours()
    return await effective_retention_for_user_ids(list(conv.get("participants") or []))


async def conversation_activity_fields_for_participants(
    participants: list[str],
    at: datetime | None = None,
) -> dict:
    hours = await effective_retention_for_user_ids(participants)
    return conversation_activity_fields(at, hours=hours)


async def bump_conversation_activity(conversation_id: str) -> None:
    hours = await get_effective_retention_for_conversation(conversation_id)
    fields = conversation_activity_fields(hours=hours)
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": fields},
    )


async def _shorten_ephemeral_expiry(conversation_id: str, cap_exp: datetime) -> None:
    await db.messages.update_many(
        {"conversation_id": conversation_id, "expires_at": {"$gt": cap_exp}},
        {"$set": {"expires_at": cap_exp}},
    )
    await db.message_reads.update_many(
        {"conversation_id": conversation_id, "expires_at": {"$gt": cap_exp}},
        {"$set": {"expires_at": cap_exp}},
    )


async def refresh_retention_after_user_change(user_id: str) -> None:
    """Recompute conversation TTL when a participant changes their retention preference."""
    convs = await db.conversations.find(
        {"participants": user_id},
        {"conversation_id": 1, "participants": 1, "_id": 0},
    ).to_list(500)
    for conv in convs:
        cid = conv["conversation_id"]
        hours = await effective_retention_for_user_ids(list(conv.get("participants") or []))
        cap_exp = expires_at_from_now(hours)
        await db.conversations.update_one(
            {"conversation_id": cid},
            {"$set": {
                "expires_at": cap_exp,
            }},
        )
        await _shorten_ephemeral_expiry(cid, cap_exp)
    if convs:
        logger.info(f"retention refresh: user={user_id} conversations={len(convs)}")


async def backfill_retention_ttl_fields() -> None:
    """One-time-safe backfill so TTL indexes can purge legacy rows missing expires_at."""
    default_exp = expires_at_from_now()
    now = now_utc()

    conv = await db.conversations.update_many(
        {"expires_at": {"$exists": False}},
        {"$set": {**conversation_activity_fields(now)}},
    )
    if conv.modified_count:
        logger.info(f"retention backfill: conversations={conv.modified_count}")

    reads = await db.message_reads.update_many(
        {"expires_at": {"$exists": False}},
        {"$set": message_read_expiry_fields()},
    )
    if reads.modified_count:
        logger.info(f"retention backfill: message_reads={reads.modified_count}")

    cursor = db.friend_requests.find({"expires_at": {"$exists": False}}, {"_id": 1, "status": 1, "created_at": 1})
    fr_fixed = 0
    async for doc in cursor:
        status = doc.get("status", "pending")
        if status == "pending":
            exp = now + timedelta(days=friend_request_pending_days())
        else:
            exp = default_exp
        await db.friend_requests.update_one({"_id": doc["_id"]}, {"$set": {"expires_at": exp}})
        fr_fixed += 1
    if fr_fixed:
        logger.info(f"retention backfill: friend_requests={fr_fixed}")

    logger.info(f"Retention TTL active — default_window={retention_hours()}h per_user=True")