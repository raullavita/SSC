"""Forward message metadata — Q.10 (mutual contacts / groups only)."""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from core.contact_helpers import are_contacts
from core.database import db
from core.message_delete import is_message_deleted
from core.message_replies import normalize_reply_to_message_id


async def validate_forward_source(
    *,
    user_id: str,
    forwarded_from_message_id: Optional[str],
    target_conversation_id: str,
) -> Optional[str]:
    normalized = normalize_reply_to_message_id(forwarded_from_message_id)
    if not normalized:
        return None

    source = await db.messages.find_one(
        {"message_id": normalized},
        {"_id": 0, "conversation_id": 1, "message_type": 1, "deleted_for_everyone_at": 1},
    )
    if not source:
        raise HTTPException(400, "Forwarded source message not found")
    if is_message_deleted(source):
        raise HTTPException(400, "Cannot forward a deleted message")
    if source.get("message_type") != "text":
        raise HTTPException(400, "Only text messages can be forwarded")

    source_conv = await db.conversations.find_one(
        {"conversation_id": source["conversation_id"]},
        {"_id": 0, "participants": 1},
    )
    if not source_conv or user_id not in source_conv.get("participants", []):
        raise HTTPException(403, "No access to forwarded source message")

    target_conv = await db.conversations.find_one(
        {"conversation_id": target_conversation_id},
        {"_id": 0, "participants": 1, "is_group": 1},
    )
    if not target_conv or user_id not in target_conv.get("participants", []):
        raise HTTPException(403, "Target conversation not found")

    if not target_conv.get("is_group") and len(target_conv.get("participants", [])) == 2:
        other = [p for p in target_conv["participants"] if p != user_id][0]
        if not await are_contacts(user_id, other):
            raise HTTPException(403, "Contact required to forward to this user")

    return normalized