"""Sesame-style decrypt retry requests — session healing."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.block_policy import interaction_blocked
from core.device_ciphertext_policy import validate_send_ciphertexts
from core.retention_policy import default_expires_at
from core.message_fanout import fanout_message_edited
from core.metadata_policy import public_message, scrub_payload
from core.signal_policy import SIGNAL_PROTOCOL_V1, validate_protocol_for_env
from core.ws_hub import ws_hub
from db import get_database
from deps import get_client_header, get_current_user_id, get_device_header

router = APIRouter(prefix="/messages", tags=["sesame"])

MAX_RETRY_PER_MESSAGE = 5


class RetryRequestBody(BaseModel):
    message_id: str = Field(min_length=3, max_length=64)
    conversation_id: str = Field(min_length=3, max_length=64)
    requester_device_id: str | None = Field(default=None, max_length=64)


class ResendCiphertextBody(BaseModel):
    device_ciphertexts: dict[str, str]
    protocol: str = Field(default=SIGNAL_PROTOCOL_V1)
    target_device_id: str | None = Field(default=None, max_length=64)


@router.post("/retry-request")
async def request_message_retry(
    body: RetryRequestBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    msg = await db.messages.find_one(
        {"_id": body.message_id, "conversation_id": body.conversation_id}
    )
    if not msg:
        raise HTTPException(status_code=404, detail="message_not_found")

    conv = await db.conversations.find_one(
        {"_id": body.conversation_id, "participants": user_id}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    sender_id = msg.get("sender_id")
    if not sender_id or sender_id == user_id:
        raise HTTPException(status_code=400, detail="retry_not_applicable")

    blocked, detail = await interaction_blocked(db, user_id, sender_id)
    if blocked:
        raise HTTPException(status_code=403, detail=detail)

    retry_key = f"retry:{body.message_id}:{user_id}"
    retry_doc = await db.message_retries.find_one({"_id": retry_key})
    count = int((retry_doc or {}).get("count", 0))
    if count >= MAX_RETRY_PER_MESSAGE:
        raise HTTPException(status_code=429, detail="retry_limit_exceeded")

    now = datetime.now(timezone.utc)
    await db.message_retries.update_one(
        {"_id": retry_key},
        {
            "$set": {
                "message_id": body.message_id,
                "conversation_id": body.conversation_id,
                "requester_id": user_id,
                "requester_device_id": body.requester_device_id,
                "updated_at": now,
                "expires_at": default_expires_at(hours=24 * 7),
            },
            "$inc": {"count": 1},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    payload = scrub_payload(
        {
            "type": "decrypt_retry_request",
            "message_id": body.message_id,
            "conversation_id": body.conversation_id,
            "requester_id": user_id,
            "requester_device_id": body.requester_device_id,
        }
    )
    await ws_hub.publish(f"user:{sender_id}", payload)
    return {"ok": True, "retry_count": count + 1}


@router.post("/{message_id}/resend-ciphertext")
async def resend_message_ciphertext(
    message_id: str,
    body: ResendCiphertextBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
    device_id: str | None = Depends(get_device_header),
) -> dict:
    """Sesame healing — sender merges per-device ciphertext without edit-window limits."""
    protocol = body.protocol or SIGNAL_PROTOCOL_V1
    ok, detail = validate_protocol_for_env(protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    valid, detail = validate_send_ciphertexts(
        ciphertext=None,
        device_ciphertexts=body.device_ciphertexts,
        protocol=protocol,
    )
    if not valid:
        raise HTTPException(status_code=400, detail=detail)

    db = get_database()
    msg = await db.messages.find_one({"_id": message_id})
    if not msg:
        raise HTTPException(status_code=404, detail="message_not_found")

    if msg.get("sender_id") != user_id:
        raise HTTPException(status_code=403, detail="resend_sender_only")

    conv = await db.conversations.find_one(
        {"_id": msg["conversation_id"], "participants": user_id}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    existing = dict(msg.get("device_ciphertexts") or {})
    merged = {**existing, **body.device_ciphertexts}
    legacy_ciphertext = msg.get("ciphertext") or next(iter(merged.values()), "")

    await db.messages.update_one(
        {"_id": message_id},
        {
            "$set": {
                "device_ciphertexts": merged,
                "ciphertext": legacy_ciphertext,
                "protocol": protocol,
            }
        },
    )
    updated = await db.messages.find_one({"_id": message_id})
    participants = conv.get("participants", [])
    await fanout_message_edited(msg["conversation_id"], updated, participants)
    return {
        "message": public_message(
            updated,
            viewer_id=user_id,
            viewer_device_id=device_id or body.target_device_id,
        )
    }