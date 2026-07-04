"""Conversation routes — Engine 3/4 metadata-minimized responses."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.conversation_meta import get_meta_map, upsert_meta
from core.read_receipts import mark_conversation_read
from core.ids import direct_conversation_key, new_conversation_id
from core.group_policy import public_group_conversation
from core.metadata_policy import public_conversation
from core.retention_policy import default_expires_at
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/conversations", tags=["conversations"])


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


class CreateConversationBody(BaseModel):
    participant_id: str = Field(min_length=3)


class ConversationMetaPatch(BaseModel):
    pinned: bool | None = None
    muted: bool | None = None


class MarkReadBody(BaseModel):
    last_message_id: str | None = Field(default=None, min_length=3, max_length=64)


@router.get("")
async def list_conversations(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    cursor = db.conversations.find({"participants": user_id}).sort("updated_at", -1)
    docs = [doc async for doc in cursor]
    meta_map = await get_meta_map(db, user_id, [d["_id"] for d in docs])
    items = []
    for doc in docs:
        meta = meta_map.get(doc["_id"])
        if doc.get("type") == "group":
            items.append(public_group_conversation(doc, user_id, meta))
        else:
            items.append(public_conversation(doc, user_id, meta))
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
        meta = await get_meta_map(db, user_id, [existing["_id"]])
        return {
            "conversation": public_conversation(
                existing, user_id, meta.get(existing["_id"])
            )
        }

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
    return {"conversation": public_conversation(doc, user_id)}


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
    meta = await get_meta_map(db, user_id, [conversation_id])
    return {"conversation": public_conversation(doc, user_id, meta.get(conversation_id))}


@router.post("/{conversation_id}/read")
async def mark_conversation_read_route(
    conversation_id: str,
    body: MarkReadBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    receipt = await mark_conversation_read(
        db, user_id, conversation_id, body.last_message_id
    )
    return {"ok": True, "receipt_sent": receipt is not None}


@router.patch("/{conversation_id}/meta")
async def patch_conversation_meta(
    conversation_id: str,
    body: ConversationMetaPatch,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    await upsert_meta(
        db,
        user_id,
        conversation_id,
        pinned=body.pinned,
        muted=body.muted,
    )
    meta = await get_meta_map(db, user_id, [conversation_id])
    return {"conversation": public_conversation(doc, user_id, meta.get(conversation_id))}