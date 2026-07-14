"""Report → block → rate-limit pipeline (Tier D6)."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from core.rate_limit import RateLimiter

ABUSE_REPORT_THRESHOLD = int(os.getenv("SSC_ABUSE_REPORT_THRESHOLD", "3"))
ABUSE_REPORT_WINDOW_HOURS = int(os.getenv("SSC_ABUSE_REPORT_WINDOW_HOURS", "24"))
ABUSE_RATE_LIMIT_HOURS = int(os.getenv("SSC_ABUSE_RATE_LIMIT_HOURS", "24"))

abuse_report_limiter = RateLimiter("abuse_report", 10, 3600)


async def record_user_block(db, blocker_id: str, blocked_id: str) -> None:
    doc_id = f"block:{blocker_id}:{blocked_id}"
    now = datetime.now(timezone.utc)
    await db.user_blocks.update_one(
        {"_id": doc_id},
        {
            "$setOnInsert": {
                "_id": doc_id,
                "blocker_id": blocker_id,
                "blocked_id": blocked_id,
                "created_at": now,
            }
        },
        upsert=True,
    )


async def remove_user_block(db, blocker_id: str, blocked_id: str) -> bool:
    doc_id = f"block:{blocker_id}:{blocked_id}"
    result = await db.user_blocks.delete_one({"_id": doc_id})
    return bool(result.deleted_count)


async def is_user_blocked(db, blocker_id: str, blocked_id: str) -> bool:
    doc_id = f"block:{blocker_id}:{blocked_id}"
    return (await db.user_blocks.find_one({"_id": doc_id})) is not None


async def count_distinct_reporters(db, target_user_id: str) -> int:
    since = datetime.now(timezone.utc) - timedelta(hours=ABUSE_REPORT_WINDOW_HOURS)
    cursor = db.abuse_reports.find(
        {"target_user_id": target_user_id, "created_at": {"$gte": since}}
    )
    reporters: set[str] = set()
    async for doc in cursor:
        reporter = doc.get("reporter_id")
        if reporter:
            reporters.add(reporter)
    return len(reporters)


async def apply_abuse_rate_limit(db, target_user_id: str) -> None:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=ABUSE_RATE_LIMIT_HOURS)
    await db.abuse_flags.update_one(
        {"_id": f"rate_limit:{target_user_id}"},
        {
            "$set": {
                "user_id": target_user_id,
                "flag": "rate_limited",
                "reason": "abuse_reports",
                "updated_at": now,
                "expires_at": expires_at,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


async def is_abuse_rate_limited(db, user_id: str) -> bool:
    doc = await db.abuse_flags.find_one({"_id": f"rate_limit:{user_id}"})
    if not doc:
        return False
    expires_at = doc.get("expires_at")
    if not expires_at:
        return True
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return False
    return True


async def process_abuse_report(
    db,
    *,
    reporter_id: str,
    target_user_id: str,
    conversation_id: str | None,
    reason: str,
    spam_score: int,
    also_block: bool,
) -> dict:
    now = datetime.now(timezone.utc)
    doc_id = f"report-{reporter_id}-{target_user_id}-{secrets.token_urlsafe(12)}"
    doc = {
        "_id": doc_id,
        "reporter_id": reporter_id,
        "target_user_id": target_user_id,
        "conversation_id": conversation_id,
        "reason": reason,
        "spam_score": spam_score,
        "created_at": now,
    }
    await db.abuse_reports.insert_one(doc)
    # Legacy collection for existing dashboards.
    await db.beta_feedback.insert_one({**doc, "legacy": True})

    if also_block:
        await record_user_block(db, reporter_id, target_user_id)

    distinct_reporters = await count_distinct_reporters(db, target_user_id)
    rate_limited = False
    if distinct_reporters >= ABUSE_REPORT_THRESHOLD:
        await apply_abuse_rate_limit(db, target_user_id)
        rate_limited = True

    return {
        "spam_score": spam_score,
        "distinct_reporters": distinct_reporters,
        "rate_limited": rate_limited,
        "blocked": also_block,
    }