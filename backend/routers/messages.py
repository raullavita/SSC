"""Message relay routes — Engine 3 placeholder ciphertext."""

from __future__ import annotations

import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.ids import new_message_id
from core.retention_policy import default_expires_at
from core.ws_hub import ws_hub
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(tags=["messages"])

PLACEHOLDER_PROTOCOL = "placeholder"


class SendMessageBody(BaseModel):
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=PLACEHOLDER_PROTOCOL)


def _public_message(doc: dict) -> dict:
    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    return {
        "id": doc["_id"],
        "conversation_id": doc["conversation_id"],
        "sender_id": doc["sender_id"],
        "ciphertext": doc["ciphertext"],
        "protocol": doc.get("protocol", PLACEHOLDER_PROTOCOL),
        "created_at": created,
    }


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    cursor = db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
    items = [_public_message(doc) async for doc in cursor]
    return {"messages": items}


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    conv = await _require_participant(db, conversation_id, user_id)

    # Validate base64-ish payload; real crypto validates in Engine 8.
    try:
        base64.b64decode(body.ciphertext, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="invalid_ciphertext") from exc

    now = datetime.now(timezone.utc)
    doc = {
        "_id": new_message_id(),
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "ciphertext": body.ciphertext,
        "protocol": body.protocol or PLACEHOLDER_PROTOCOL,
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.messages.insert_one(doc)
    await db.conversations.update_one(
        {"_id": conversation_id},
        {"$set": {"updated_at": now}},
    )

    message = _public_message(doc)
    topic = f"conversation:{conversation_id}"
    await ws_hub.publish(
        topic,
        {"type": "message", "message": message, "participants": conv.get("participants", [])},
    )
    return {"message": message}