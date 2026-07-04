"""Conversation routes — Engine 3."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.ids import direct_conversation_key, new_conversation_id
from core.retention_policy import default_expires_at
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/conversations", tags=["conversations"])


class CreateConversationBody(BaseModel):
    participant_id: str = Field(min_length=3)


def _public_conversation(doc: dict, viewer_id: str) -> dict:
    participants = doc.get("participants", [])
    peer = next((p for p in participants if p != viewer_id), None)
    return {
        "id": doc["_id"],
        "type": doc.get("type", "direct"),
        "participants": participants,
        "peer_id": peer,
        "updated_at": doc.get("updated_at"),
        "created_at": doc.get("created_at"),
    }


@router.get("")
async def list_conversations(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    cursor = db.conversations.find({"participants": user_id}).sort("updated_at", -1)
    items = []
    async for doc in cursor:
        items.append(_public_conversation(doc, user_id))
    return {"conversations": items}


@router.post("")
async def create_conversation(
    body: CreateConversationBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if body.participant_id == user_id:
        raise HTTPException(status_code=400, detail="cannot_chat_with_self")

    db = get_database()
    peer = await db.users.find_one({"_id": body.participant_id})
    if not peer:
        raise HTTPException(status_code=404, detail="participant_not_found")

    key = direct_conversation_key(user_id, body.participant_id)
    existing = await db.conversations.find_one({"direct_key": key})
    if existing:
        return {"conversation": _public_conversation(existing, user_id)}

    now = datetime.now(timezone.utc)
    doc = {
        "_id": new_conversation_id(),
        "type": "direct",
        "direct_key": key,
        "participants": sorted([user_id, body.participant_id]),
        "created_at": now,
        "updated_at": now,
        "expires_at": default_expires_at(),
    }
    await db.conversations.insert_one(doc)
    return {"conversation": _public_conversation(doc, user_id)}


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return {"conversation": _public_conversation(doc, user_id)}