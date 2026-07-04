"""Read receipts + unread counts — opt-in via privacy_settings — Engine 4/13."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.last_seen import default_privacy_settings
from core.retention_policy import default_expires_at
from core.ws_hub import ws_hub


async def increment_unread(
    db,
    conversation_id: str,
    participants: list[str],
    sender_id: str,
) -> None:
    for uid in participants:
        if uid == sender_id:
            continue
        await db.conversation_meta.update_one(
            {"user_id": uid, "conversation_id": conversation_id},
            {
                "$inc": {"unread_count": 1},
                "$setOnInsert": {"pinned": False, "muted": False},
            },
            upsert=True,
        )


async def reset_unread(db, user_id: str, conversation_id: str) -> None:
    await db.conversation_meta.update_one(
        {"user_id": user_id, "conversation_id": conversation_id},
        {
            "$set": {"unread_count": 0},
            "$setOnInsert": {"pinned": False, "muted": False},
        },
        upsert=True,
    )


async def mark_conversation_read(
    db,
    user_id: str,
    conversation_id: str,
    last_message_id: str | None,
) -> dict[str, Any] | None:
    await reset_unread(db, user_id, conversation_id)

    if not last_message_id:
        return None

    user = await db.users.find_one({"_id": user_id}, {"privacy_settings": 1})
    settings = (user or {}).get("privacy_settings") or default_privacy_settings()
    if not settings.get("read_receipts"):
        return None

    msg = await db.messages.find_one(
        {"_id": last_message_id, "conversation_id": conversation_id}
    )
    if not msg or msg.get("sender_id") == user_id:
        return None

    now = datetime.now(timezone.utc)
    read_id = f"{conversation_id}:{user_id}:{last_message_id}"
    doc = {
        "_id": read_id,
        "conversation_id": conversation_id,
        "message_id": last_message_id,
        "user_id": user_id,
        "reader_id": user_id,
        "sender_id": msg["sender_id"],
        "read_at": now,
        "expires_at": default_expires_at(),
    }
    await db.message_reads.update_one({"_id": read_id}, {"$set": doc}, upsert=True)

    receipt = {
        "type": "read_receipt",
        "conversation_id": conversation_id,
        "message_id": last_message_id,
        "reader_id": user_id,
        "read_at": now.isoformat(),
    }
    await ws_hub.publish(f"conversation:{conversation_id}", receipt)
    await ws_hub.publish(f"user:{msg['sender_id']}", receipt)
    return receipt