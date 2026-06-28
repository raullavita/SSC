"""Per-user conversation pins — Q.12 (sidebar ordering only)."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from fastapi import HTTPException

from core.database import db
from core.utils import iso, now_utc

MAX_PINS_PER_USER = 20


def _iso_pinned_at(value) -> str:
    if isinstance(value, datetime):
        return iso(value)
    return str(value) if value else ""


async def pins_map_for_user(user_id: str) -> Dict[str, str]:
    rows = await db.conversation_pins.find(
        {"user_id": user_id},
        {"_id": 0, "conversation_id": 1, "pinned_at": 1},
    ).to_list(MAX_PINS_PER_USER + 10)
    return {
        row["conversation_id"]: _iso_pinned_at(row.get("pinned_at"))
        for row in rows
        if row.get("conversation_id")
    }


async def attach_pin_fields(conversations: List[dict], user_id: str) -> List[dict]:
    pin_map = await pins_map_for_user(user_id)
    for conv in conversations:
        pinned_at = pin_map.get(conv.get("conversation_id"))
        conv["pinned"] = pinned_at is not None
        if pinned_at:
            conv["pinned_at"] = pinned_at
    return conversations


def sort_conversations_for_sidebar(conversations: List[dict]) -> List[dict]:
    pinned = [c for c in conversations if c.get("pinned")]
    unpinned = [c for c in conversations if not c.get("pinned")]
    pinned.sort(key=lambda c: c.get("pinned_at") or "", reverse=True)
    unpinned.sort(
        key=lambda c: c.get("last_activity_at") or c.get("created_at") or "",
        reverse=True,
    )
    return pinned + unpinned


async def _require_member(user_id: str, conversation_id: str) -> dict:
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user_id not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    return conv


async def pin_conversation(user_id: str, conversation_id: str) -> dict:
    conv = await _require_member(user_id, conversation_id)
    existing = await db.conversation_pins.find_one(
        {"user_id": user_id, "conversation_id": conversation_id},
        {"_id": 0, "pinned_at": 1},
    )
    if existing:
        conv["pinned"] = True
        conv["pinned_at"] = _iso_pinned_at(existing.get("pinned_at"))
        return conv

    count = await db.conversation_pins.count_documents({"user_id": user_id})
    if count >= MAX_PINS_PER_USER:
        raise HTTPException(400, f"Maximum {MAX_PINS_PER_USER} pinned chats")

    pinned_at = iso(now_utc())
    await db.conversation_pins.insert_one({
        "user_id": user_id,
        "conversation_id": conversation_id,
        "pinned_at": pinned_at,
    })
    conv["pinned"] = True
    conv["pinned_at"] = pinned_at
    return conv


async def unpin_conversation(user_id: str, conversation_id: str) -> dict:
    conv = await _require_member(user_id, conversation_id)
    await db.conversation_pins.delete_one({"user_id": user_id, "conversation_id": conversation_id})
    conv["pinned"] = False
    conv.pop("pinned_at", None)
    return conv


async def clear_pins_for_conversation(conversation_id: str) -> None:
    await db.conversation_pins.delete_many({"conversation_id": conversation_id})