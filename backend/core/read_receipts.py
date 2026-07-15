"""Read receipts + unread counts — opt-in via privacy_settings — Engine 4/13."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.block_policy import should_deliver_to_participant
from core.conversation_privacy_policy import effective_read_receipts
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
        if not await should_deliver_to_participant(db, sender_id, uid):
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
    meta = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    if not effective_read_receipts(settings, meta):
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


def public_read_receipt(doc: dict[str, Any]) -> dict[str, Any]:
    """Metadata-minimized read receipt — message_id, reader_id, read_at (no email)."""
    read_at = doc.get("read_at")
    if hasattr(read_at, "isoformat"):
        read_at = read_at.isoformat()
    out = {
        "message_id": doc["message_id"],
        "read_at": read_at,
    }
    reader_id = doc.get("reader_id") or doc.get("user_id")
    if reader_id:
        out["reader_id"] = reader_id
    return out


async def list_read_receipts_for_sender(
    db,
    user_id: str,
    conversation_id: str,
) -> list[dict[str, Any]]:
    """Reads on messages the current user sent (for double-check UI)."""
    cursor = db.message_reads.find(
        {"conversation_id": conversation_id, "sender_id": user_id},
        {"message_id": 1, "read_at": 1, "reader_id": 1, "user_id": 1, "_id": 0},
    )
    return [public_read_receipt(doc) async for doc in cursor]