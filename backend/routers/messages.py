"""Message relay routes — Engine 8 signal_v1 ciphertext."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from config import get_settings
from core.abuse_policy import msg_rate_limiter
from core.ids import new_message_id
from core.metadata_policy import public_message
from core.retention_policy import default_expires_at
from core.signal_policy import (
    LEGACY_PLACEHOLDER_PROTOCOL,
    SIGNAL_PROTOCOL_V1,
    validate_signal_ciphertext,
)
from core.ws_hub import ws_hub
from db import get_database
from deps import get_client_header, get_current_user_id
from push import notify_conversation_participants

router = APIRouter(tags=["messages"])


class SendMessageBody(BaseModel):
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_V1)


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


def _enforce_protocol_policy(protocol: str) -> None:
    settings = get_settings()
    if settings.is_production and protocol == LEGACY_PLACEHOLDER_PROTOCOL:
        raise HTTPException(status_code=400, detail="placeholder_protocol_forbidden_in_production")


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    cursor = db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
    items = [public_message(doc) async for doc in cursor]
    return {"messages": items}


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageBody,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not msg_rate_limiter.allow(f"msg:{user_id}"):
        raise HTTPException(status_code=429, detail="message_rate_limited")

    protocol = body.protocol or SIGNAL_PROTOCOL_V1
    _enforce_protocol_policy(protocol)

    ok, detail = validate_signal_ciphertext(body.ciphertext, protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    db = get_database()
    conv = await _require_participant(db, conversation_id, user_id)

    now = datetime.now(timezone.utc)
    doc = {
        "_id": new_message_id(),
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "ciphertext": body.ciphertext,
        "protocol": protocol,
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.messages.insert_one(doc)
    await db.conversations.update_one(
        {"_id": conversation_id},
        {"$set": {"updated_at": now}},
    )

    message = public_message(doc)
    topic = f"conversation:{conversation_id}"
    await ws_hub.publish(
        topic,
        {"type": "message", "message": message, "participants": conv.get("participants", [])},
    )

    background_tasks.add_task(
        notify_conversation_participants,
        conv.get("participants", []),
        sender_id=user_id,
        conversation_id=conversation_id,
        message_id=doc["_id"],
    )

    return {"message": message}