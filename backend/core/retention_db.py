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
from core.utils import iso, now_utc


async def bump_conversation_activity(conversation_id: str) -> None:
    fields = conversation_activity_fields()
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": fields},
    )


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

    logger.info(f"Retention TTL active — window={retention_hours()}h")