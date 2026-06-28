"""Group poll votes — Q.23 (metadata only, retention TTL)."""
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

MIN_POLL_OPTIONS = 2
MAX_POLL_OPTIONS = 12


def normalize_poll_option_count(value: Optional[int]) -> int:
    if not isinstance(value, int) or value < MIN_POLL_OPTIONS or value > MAX_POLL_OPTIONS:
        raise HTTPException(
            400,
            f"poll_option_count must be between {MIN_POLL_OPTIONS} and {MAX_POLL_OPTIONS}",
        )
    return value


def normalize_poll_option_index(index: Optional[int], option_count: int) -> int:
    if not isinstance(index, int) or index < 0 or index >= option_count:
        raise HTTPException(400, "Invalid poll option")
    return index


def _vote_row(user_id: str, option_index: int) -> dict:
    return {"user_id": user_id, "option_index": option_index}


async def list_poll_votes_for_message(message_id: str) -> List[dict]:
    rows = await db.message_poll_votes.find(
        {"message_id": message_id},
        {"_id": 0, "user_id": 1, "option_index": 1},
    ).to_list(200)
    return [_vote_row(r["user_id"], r["option_index"]) for r in rows]


async def attach_poll_votes_to_messages(conversation_id: str, messages: List[dict]) -> List[dict]:
    if not messages:
        return messages
    poll_ids = [
        m.get("message_id")
        for m in messages
        if m.get("message_id") and m.get("message_type") == "poll"
    ]
    if not poll_ids:
        return messages
    rows = await db.message_poll_votes.find(
        {"conversation_id": conversation_id, "message_id": {"$in": poll_ids}},
        {"_id": 0, "message_id": 1, "user_id": 1, "option_index": 1},
    ).to_list(5000)
    by_msg: Dict[str, List[dict]] = defaultdict(list)
    for row in rows:
        by_msg[row["message_id"]].append(_vote_row(row["user_id"], row["option_index"]))
    for msg in messages:
        if msg.get("message_type") == "poll":
            msg["poll_votes"] = by_msg.get(msg.get("message_id"), [])
    return messages


async def set_poll_vote(
    *,
    user_id: str,
    conversation_id: str,
    message_id: str,
    option_index: int,
) -> dict:
    normalized_id = normalize_reply_to_message_id(message_id)

    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user_id not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(403, "Polls are only available in group chats")

    msg = await db.messages.find_one(
        {"message_id": normalized_id, "conversation_id": conversation_id},
        {"_id": 0, "message_id": 1, "message_type": 1, "poll_option_count": 1, "deleted_for_everyone_at": 1},
    )
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg.get("message_type") != "poll":
        raise HTTPException(400, "Message is not a poll")
    if is_message_deleted(msg):
        raise HTTPException(400, "Cannot vote on a deleted poll")

    option_count = normalize_poll_option_count(msg.get("poll_option_count"))
    normalized_index = normalize_poll_option_index(option_index, option_count)

    existing = await db.message_poll_votes.find_one(
        {"message_id": normalized_id, "user_id": user_id},
        {"_id": 0, "option_index": 1},
    )

    if existing and existing.get("option_index") == normalized_index:
        poll_votes = await list_poll_votes_for_message(normalized_id)
        return {
            "message_id": normalized_id,
            "conversation_id": conversation_id,
            "poll_votes": poll_votes,
        }

    retention = await get_effective_retention_for_conversation(conversation_id)
    await db.message_poll_votes.update_one(
        {"message_id": normalized_id, "user_id": user_id},
        {
            "$set": {
                "message_id": normalized_id,
                "conversation_id": conversation_id,
                "user_id": user_id,
                "option_index": normalized_index,
                "created_at": iso(now_utc()),
                "expires_at": expires_at_from_now(retention),
            }
        },
        upsert=True,
    )

    poll_votes = await list_poll_votes_for_message(normalized_id)
    return {
        "message_id": normalized_id,
        "conversation_id": conversation_id,
        "poll_votes": poll_votes,
    }