"""Per-user conversation archives — Q.13 (hide from main sidebar)."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from fastapi import HTTPException

from core.database import db
from core.utils import iso, now_utc

MAX_ARCHIVES_PER_USER = 200


def _iso_archived_at(value) -> str:
    if isinstance(value, datetime):
        return iso(value)
    return str(value) if value else ""


async def archives_map_for_user(user_id: str) -> Dict[str, str]:
    rows = await db.conversation_archives.find(
        {"user_id": user_id},
        {"_id": 0, "conversation_id": 1, "archived_at": 1},
    ).to_list(MAX_ARCHIVES_PER_USER + 10)
    return {
        row["conversation_id"]: _iso_archived_at(row.get("archived_at"))
        for row in rows
        if row.get("conversation_id")
    }


async def attach_archive_fields(conversations: List[dict], user_id: str) -> List[dict]:
    archive_map = await archives_map_for_user(user_id)
    for conv in conversations:
        archived_at = archive_map.get(conv.get("conversation_id"))
        conv["archived"] = archived_at is not None
        if archived_at:
            conv["archived_at"] = archived_at
    return conversations


def sort_archived_conversations(conversations: List[dict]) -> List[dict]:
    archived = [c for c in conversations if c.get("archived")]
    archived.sort(key=lambda c: c.get("archived_at") or "", reverse=True)
    return archived


async def _require_member(user_id: str, conversation_id: str) -> dict:
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user_id not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    return conv


async def archive_conversation(user_id: str, conversation_id: str) -> dict:
    conv = await _require_member(user_id, conversation_id)
    existing = await db.conversation_archives.find_one(
        {"user_id": user_id, "conversation_id": conversation_id},
        {"_id": 0, "archived_at": 1},
    )
    if existing:
        conv["archived"] = True
        conv["archived_at"] = _iso_archived_at(existing.get("archived_at"))
        return conv

    count = await db.conversation_archives.count_documents({"user_id": user_id})
    if count >= MAX_ARCHIVES_PER_USER:
        raise HTTPException(400, f"Maximum {MAX_ARCHIVES_PER_USER} archived chats")

    archived_at = iso(now_utc())
    await db.conversation_archives.insert_one({
        "user_id": user_id,
        "conversation_id": conversation_id,
        "archived_at": archived_at,
    })
    await db.conversation_pins.delete_one({"user_id": user_id, "conversation_id": conversation_id})
    conv["archived"] = True
    conv["archived_at"] = archived_at
    conv["pinned"] = False
    conv.pop("pinned_at", None)
    return conv


async def unarchive_conversation(user_id: str, conversation_id: str) -> dict:
    conv = await _require_member(user_id, conversation_id)
    await db.conversation_archives.delete_one({"user_id": user_id, "conversation_id": conversation_id})
    conv["archived"] = False
    conv.pop("archived_at", None)
    return conv


async def clear_archives_for_conversation(conversation_id: str) -> None:
    await db.conversation_archives.delete_many({"conversation_id": conversation_id})