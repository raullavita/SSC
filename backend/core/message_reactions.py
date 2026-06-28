"""Message reactions — Q.11 (metadata only, retention TTL)."""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional

from fastapi import HTTPException

from core.database import db
from core.message_delete import is_message_deleted
from core.message_replies import normalize_reply_to_message_id
from core.retention import expires_at_from_now
from core.retention_db import get_effective_retention_for_conversation
from core.utils import iso, now_utc

ALLOWED_REACTION_EMOJI = frozenset({"👍", "❤️", "😂", "😮", "😢", "🙏"})


def normalize_reaction_emoji(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if raw not in ALLOWED_REACTION_EMOJI:
        raise HTTPException(400, "Invalid reaction emoji")
    return raw


def _reaction_row(user_id: str, emoji: str) -> dict:
    return {"user_id": user_id, "emoji": emoji}


async def list_reactions_for_message(message_id: str) -> List[dict]:
    rows = await db.message_reactions.find(
        {"message_id": message_id},
        {"_id": 0, "user_id": 1, "emoji": 1},
    ).to_list(200)
    return [_reaction_row(r["user_id"], r["emoji"]) for r in rows]


async def attach_reactions_to_messages(conversation_id: str, messages: List[dict]) -> List[dict]:
    if not messages:
        return messages
    ids = [m.get("message_id") for m in messages if m.get("message_id")]
    if not ids:
        return messages
    rows = await db.message_reactions.find(
        {"conversation_id": conversation_id, "message_id": {"$in": ids}},
        {"_id": 0, "message_id": 1, "user_id": 1, "emoji": 1},
    ).to_list(5000)
    by_msg: Dict[str, List[dict]] = defaultdict(list)
    for row in rows:
        by_msg[row["message_id"]].append(_reaction_row(row["user_id"], row["emoji"]))
    for msg in messages:
        msg["reactions"] = by_msg.get(msg.get("message_id"), [])
    return messages


async def set_message_reaction(
    *,
    user_id: str,
    conversation_id: str,
    message_id: str,
    emoji: Optional[str],
) -> dict:
    normalized_id = normalize_reply_to_message_id(message_id)
    normalized_emoji = normalize_reaction_emoji(emoji)

    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user_id not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")

    msg = await db.messages.find_one(
        {"message_id": normalized_id, "conversation_id": conversation_id},
        {"_id": 0, "message_id": 1, "message_type": 1, "deleted_for_everyone_at": 1},
    )
    if not msg:
        raise HTTPException(404, "Message not found")
    if is_message_deleted(msg):
        raise HTTPException(400, "Cannot react to a deleted message")

    existing = await db.message_reactions.find_one(
        {"message_id": normalized_id, "user_id": user_id},
        {"_id": 0, "emoji": 1},
    )

    if not normalized_emoji or (existing and existing.get("emoji") == normalized_emoji):
        await db.message_reactions.delete_one({"message_id": normalized_id, "user_id": user_id})
    else:
        retention = await get_effective_retention_for_conversation(conversation_id)
        await db.message_reactions.update_one(
            {"message_id": normalized_id, "user_id": user_id},
            {
                "$set": {
                    "message_id": normalized_id,
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "emoji": normalized_emoji,
                    "created_at": iso(now_utc()),
                    "expires_at": expires_at_from_now(retention),
                }
            },
            upsert=True,
        )

    reactions = await list_reactions_for_message(normalized_id)
    return {"message_id": normalized_id, "conversation_id": conversation_id, "reactions": reactions}