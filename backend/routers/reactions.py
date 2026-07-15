"""Dedicated encrypted reactions API — Phase C3."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.abuse_policy import msg_rate_limiter
from core.ids import new_reaction_id
from core.message_fanout import fanout_reaction_event
from core.reaction_policy import SIGNAL_PROTOCOL_REACTION, public_reaction
from core.retention_policy import default_expires_at
from core.signal_policy import validate_protocol_for_env, validate_signal_ciphertext
from db import get_database
from deps import get_client_header, get_current_user_id
from push import notify_conversation_participants

router = APIRouter(tags=["reactions"])


class AddReactionBody(BaseModel):
    target_message_id: str = Field(min_length=3)
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_REACTION)


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


@router.get("/conversations/{conversation_id}/reactions")
async def list_conversation_reactions(
    conversation_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    now = datetime.now(timezone.utc)
    cursor = db.message_reactions.find(
        {
            "conversation_id": conversation_id,
            "$or": [
                {"expires_at": {"$gt": now}},
                {"expires_at": None},
            ],
        }
    ).sort("created_at", 1).limit(limit)
    items = []
    async for doc in cursor:
        row = public_reaction(doc, viewer_id=user_id)
        if row:
            items.append(row)
    return {"reactions": items}


@router.get("/conversations/{conversation_id}/messages/{message_id}/reactions")
async def list_message_reactions(
    conversation_id: str,
    message_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    target = await db.messages.find_one({"_id": message_id, "conversation_id": conversation_id})
    if not target:
        raise HTTPException(status_code=404, detail="message_not_found")

    now = datetime.now(timezone.utc)
    cursor = db.message_reactions.find(
        {
            "conversation_id": conversation_id,
            "target_message_id": message_id,
            "$or": [
                {"expires_at": {"$gt": now}},
                {"expires_at": None},
            ],
        }
    ).sort("created_at", 1).limit(limit)
    items = []
    async for doc in cursor:
        row = public_reaction(doc, viewer_id=user_id)
        if row:
            items.append(row)
    return {"target_message_id": message_id, "reactions": items}


@router.post("/conversations/{conversation_id}/reactions")
async def add_reaction(
    conversation_id: str,
    body: AddReactionBody,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not await msg_rate_limiter.allow(f"rx:{user_id}"):
        raise HTTPException(status_code=429, detail="reaction_rate_limited")

    protocol = body.protocol or SIGNAL_PROTOCOL_REACTION
    ok, detail = validate_protocol_for_env(protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)
    ok, detail = validate_signal_ciphertext(body.ciphertext, protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    db = get_database()
    conv = await _require_participant(db, conversation_id, user_id)
    target = await db.messages.find_one(
        {"_id": body.target_message_id, "conversation_id": conversation_id}
    )
    if not target or target.get("message_kind") == "deleted":
        raise HTTPException(status_code=404, detail="target_message_not_found")

    now = datetime.now(timezone.utc)
    doc = {
        "_id": new_reaction_id(),
        "conversation_id": conversation_id,
        "target_message_id": body.target_message_id,
        "sender_id": user_id,
        "ciphertext": body.ciphertext,
        "protocol": protocol,
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.message_reactions.insert_one(doc)
    participants = conv.get("participants", [])
    public = public_reaction(doc, viewer_id=None)
    await fanout_reaction_event(
        conversation_id,
        public,
        participants,
        event_type="reaction_added",
        sender_id=user_id,
    )
    background_tasks.add_task(
        notify_conversation_participants,
        participants,
        sender_id=user_id,
        conversation_id=conversation_id,
        message_id=doc["_id"],
        kind="reaction",
    )
    return {"reaction": public_reaction(doc, viewer_id=user_id)}


@router.delete("/reactions/{reaction_id}")
async def remove_reaction(
    reaction_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc = await db.message_reactions.find_one({"_id": reaction_id})
    if not doc:
        raise HTTPException(status_code=404, detail="reaction_not_found")
    if doc.get("sender_id") != user_id:
        raise HTTPException(status_code=403, detail="not_reaction_owner")

    conv = await _require_participant(db, doc["conversation_id"], user_id)
    await db.message_reactions.delete_one({"_id": reaction_id})
    participants = conv.get("participants", [])
    await fanout_reaction_event(
        doc["conversation_id"],
        {"id": reaction_id, "target_message_id": doc["target_message_id"]},
        participants,
        event_type="reaction_removed",
        sender_id=user_id,
    )
    return {"ok": True, "reaction_id": reaction_id}