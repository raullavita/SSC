"""Message send and read-receipt routes."""
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_helpers import are_contacts
from core.contact_graph import is_blocked_pair
from core.database import db
from core.logging_config import logger
from core.models import MarkReadIn, SendMessageIn
from core.push_helpers import send_push_for_message
from core.api_integrity import project_message_for_viewer, sanitize_message_for_storage
from core.signal_message_policy import SignalMessageValidationError, validate_send_payload
from core.signal_policy import ProtocolVersion
from core.realtime import broadcast_message_to_conversation, broadcast_to_conversation
from core.retention import expires_at_from_now, message_read_expiry_fields
from core.message_replies import validate_reply_target
from core.retention_db import bump_conversation_activity, get_effective_retention_for_conversation
from core.privacy_settings import read_receipts_enabled
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


@router.post("")
async def send_message(body: SendMessageIn, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": body.conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(404, "Conversation not found")

    if not conv.get("is_group") and len(conv.get("participants", [])) == 2:
        other = [p for p in conv["participants"] if p != current["user_id"]][0]
        if await is_blocked_pair(current["user_id"], other):
            raise HTTPException(403, "Cannot message this user — blocked")
        if not await are_contacts(current["user_id"], other):
            raise HTTPException(403, "Contact required to message this user")

    if len(body.ciphertext or "") > 300000:
        raise HTTPException(413, "Message too large")

    if not rate_limit_check(f"msg:{current['user_id']}", max_hits=30, window_sec=60):
        logger.warning(f"rate-limit message user={current['user_id']}")
        raise HTTPException(429, "Too many messages sent, please slow down")

    try:
        normalized = validate_send_payload(
            protocol=body.protocol,
            ciphertext=body.ciphertext,
            iv=body.iv,
            encrypted_keys=body.encrypted_keys,
            signal_message_type=body.signal_message_type,
            is_group=bool(conv.get("is_group")),
            participant_ids=list(conv.get("participants") or []),
            attachment_id=body.attachment_id,
            attachment_iv=body.attachment_iv,
            attachment_encrypted_keys=body.attachment_encrypted_keys,
            distribution_id=body.distribution_id,
        )
    except SignalMessageValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    if normalized["protocol"] == ProtocolVersion.LEGACY_RSA.value:
        enc_keys = normalized["encrypted_keys"] or {}
        if len(enc_keys) > 50 or any(len(v) > 1000 for v in enc_keys.values()):
            raise HTTPException(413, "Encrypted keys too large or too many")

    reply_to = await validate_reply_target(body.conversation_id, body.reply_to_message_id)

    created = now_utc()
    retention_window = await get_effective_retention_for_conversation(body.conversation_id)
    expires = expires_at_from_now(retention_window)
    msg = sanitize_message_for_storage({
        "message_id": f"m_{uuid.uuid4().hex[:14]}",
        "conversation_id": body.conversation_id,
        "sender_id": current["user_id"],
        "protocol": normalized["protocol"],
        "ciphertext": normalized["ciphertext"],
        "iv": normalized["iv"],
        "encrypted_keys": normalized["encrypted_keys"],
        "signal_message_type": normalized["signal_message_type"],
        "distribution_id": normalized.get("distribution_id"),
        "message_type": body.message_type,
        "attachment_id": body.attachment_id,
        "attachment_iv": body.attachment_iv,
        "attachment_encrypted_keys": body.attachment_encrypted_keys,
        "attachment_content_type": body.attachment_content_type,
        "reply_to_message_id": reply_to,
        "created_at": iso(created),
        "expires_at": expires,
    })
    await db.messages.insert_one(msg)
    await bump_conversation_activity(body.conversation_id)
    msg["expires_at"] = iso(expires)
    msg.pop("_id", None)
    from core.last_seen import touch_last_seen
    await touch_last_seen(db, current["user_id"])
    await broadcast_message_to_conversation(body.conversation_id, msg)
    asyncio.create_task(send_push_for_message(conv, current, msg))
    return project_message_for_viewer(msg, current["user_id"])


@router.post("/read")
async def mark_read(body: MarkReadIn, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": body.conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(404, "Conversation not found")
    up_to = body.up_to_message_id
    if not up_to:
        last = await db.messages.find_one(
            {"conversation_id": body.conversation_id},
            {"_id": 0, "message_id": 1, "created_at": 1},
            sort=[("created_at", -1)],
        )
        if not last:
            return {"ok": True}
        up_to = last["message_id"]
    read_at = iso(now_utc())
    retention_window = await get_effective_retention_for_conversation(body.conversation_id)
    await db.message_reads.update_one(
        {"conversation_id": body.conversation_id, "user_id": current["user_id"]},
        {"$set": {
            "last_read_message_id": up_to,
            "last_read_at": read_at,
            **message_read_expiry_fields(retention_window),
        }},
        upsert=True,
    )
    await bump_conversation_activity(body.conversation_id)
    if read_receipts_enabled(current):
        await broadcast_to_conversation(body.conversation_id, {
            "type": "read",
            "conversation_id": body.conversation_id,
            "user_id": current["user_id"],
            "last_read_message_id": up_to,
        })
    return {"ok": True}