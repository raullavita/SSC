"""Message send and read-receipt routes."""
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_helpers import are_contacts
from core.database import db
from core.logging_config import logger
from core.models import MarkReadIn, SendMessageIn
from core.push_helpers import send_push_for_message
from core.api_integrity import project_message_for_viewer, sanitize_message_for_storage
from core.realtime import broadcast_message_to_conversation, broadcast_to_conversation
from core.retention import expires_at_from_now, message_read_expiry_fields
from core.retention_db import bump_conversation_activity
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
        if not await are_contacts(current["user_id"], other):
            raise HTTPException(403, "Contact required to message this user")

    missing = [uid for uid in conv["participants"] if uid not in body.encrypted_keys]
    if missing:
        raise HTTPException(400, f"encrypted_keys missing for participants: {','.join(missing)}")
    if len(body.ciphertext or "") > 300000:
        raise HTTPException(413, "Message too large")

    if not rate_limit_check(f"msg:{current['user_id']}", max_hits=30, window_sec=60):
        logger.warning(f"rate-limit message user={current['user_id']}")
        raise HTTPException(429, "Too many messages sent, please slow down")

    if len(body.encrypted_keys) > 50 or any(len(v) > 1000 for v in body.encrypted_keys.values()):
        raise HTTPException(413, "Encrypted keys too large or too many")

    created = now_utc()
    expires = expires_at_from_now()
    msg = sanitize_message_for_storage({
        "message_id": f"m_{uuid.uuid4().hex[:14]}",
        "conversation_id": body.conversation_id,
        "sender_id": current["user_id"],
        "ciphertext": body.ciphertext,
        "iv": body.iv,
        "encrypted_keys": body.encrypted_keys,
        "message_type": body.message_type,
        "attachment_id": body.attachment_id,
        "attachment_iv": body.attachment_iv,
        "attachment_encrypted_keys": body.attachment_encrypted_keys,
        "attachment_content_type": body.attachment_content_type,
        "created_at": iso(created),
        "expires_at": expires,
    })
    await db.messages.insert_one(msg)
    await bump_conversation_activity(body.conversation_id)
    msg["expires_at"] = iso(expires)
    msg.pop("_id", None)
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {"last_seen": iso(now_utc())}})
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
    await db.message_reads.update_one(
        {"conversation_id": body.conversation_id, "user_id": current["user_id"]},
        {"$set": {
            "last_read_message_id": up_to,
            "last_read_at": read_at,
            **message_read_expiry_fields(),
        }},
        upsert=True,
    )
    await bump_conversation_activity(body.conversation_id)
    await broadcast_to_conversation(body.conversation_id, {
        "type": "read",
        "conversation_id": body.conversation_id,
        "user_id": current["user_id"],
        "last_read_message_id": up_to,
    })
    return {"ok": True}