"""Message send and read-receipt routes."""
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_helpers import are_contacts
from core.contact_graph import is_blocked_pair
from core.database import db
from core.logging_config import logger
from core.models import EditMessageIn, MarkReadIn, MessageReactionIn, PollVoteIn, SendMessageIn, UnsendMessageIn
from core.message_polls import normalize_poll_option_count, set_poll_vote
from core.message_reactions import set_message_reaction
from core.message_delete import unsend_message_for_everyone
from core.message_edit import edit_message_text
from core.push_helpers import send_push_for_message
from core.api_integrity import project_message_for_viewer, sanitize_message_for_storage
from core.signal_message_policy import SignalMessageValidationError, validate_send_payload
from core.signal_policy import ProtocolVersion
from core.realtime import (
    broadcast_message_edited_to_conversation,
    broadcast_message_to_conversation,
    broadcast_to_conversation,
)
from core.retention import expires_at_from_now, message_read_expiry_fields
from core.message_replies import validate_reply_target
from core.message_forwards import validate_forward_source
from core.group_roles import can_post_in_group
from core.message_mentions import validate_mentioned_users_for_group
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

    if conv.get("is_group") and not can_post_in_group(conv, current["user_id"]):
        raise HTTPException(403, "Only admins can post in this group")

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
    forwarded_from = await validate_forward_source(
        user_id=current["user_id"],
        forwarded_from_message_id=body.forwarded_from_message_id,
        target_conversation_id=body.conversation_id,
    )
    mentioned_user_ids = validate_mentioned_users_for_group(
        is_group=bool(conv.get("is_group")),
        participant_ids=list(conv.get("participants") or []),
        mentioned_user_ids=body.mentioned_user_ids,
        sender_id=current["user_id"],
    )

    poll_option_count = None
    if body.message_type == "poll":
        if not conv.get("is_group"):
            raise HTTPException(403, "Polls are only allowed in group chats")
        poll_option_count = normalize_poll_option_count(body.poll_option_count)

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
        "forwarded_from_message_id": forwarded_from,
        "mentioned_user_ids": mentioned_user_ids or None,
        "poll_option_count": poll_option_count,
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


@router.post("/unsend")
async def unsend_message(body: UnsendMessageIn, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": body.conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(404, "Conversation not found")

    msg = await unsend_message_for_everyone(
        message_id=body.message_id,
        conversation_id=body.conversation_id,
        user_id=current["user_id"],
    )
    deleted_at = msg.get("deleted_for_everyone_at")
    await broadcast_to_conversation(body.conversation_id, {
        "type": "message-deleted",
        "conversation_id": body.conversation_id,
        "message_id": body.message_id,
        "deleted_at": deleted_at,
    })
    return project_message_for_viewer(msg, current["user_id"])


@router.post("/edit")
async def edit_message(body: EditMessageIn, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": body.conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(404, "Conversation not found")

    if len(body.ciphertext or "") > 300000:
        raise HTTPException(413, "Message too large")

    if not rate_limit_check(f"msg-edit:{current['user_id']}", max_hits=20, window_sec=60):
        logger.warning(f"rate-limit message-edit user={current['user_id']}")
        raise HTTPException(429, "Too many edits, please slow down")

    msg = await edit_message_text(
        message_id=body.message_id,
        conversation_id=body.conversation_id,
        user_id=current["user_id"],
        protocol=body.protocol,
        ciphertext=body.ciphertext,
        iv=body.iv,
        encrypted_keys=body.encrypted_keys,
        signal_message_type=body.signal_message_type,
        distribution_id=body.distribution_id,
    )
    await bump_conversation_activity(body.conversation_id)
    await broadcast_message_edited_to_conversation(body.conversation_id, msg)
    return project_message_for_viewer(msg, current["user_id"])


@router.post("/reactions")
async def react_to_message(body: MessageReactionIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"msg-react:{current['user_id']}", max_hits=60, window_sec=60):
        logger.warning(f"rate-limit message-reaction user={current['user_id']}")
        raise HTTPException(429, "Too many reactions, please slow down")

    result = await set_message_reaction(
        user_id=current["user_id"],
        conversation_id=body.conversation_id,
        message_id=body.message_id,
        emoji=body.emoji,
    )
    await broadcast_to_conversation(body.conversation_id, {
        "type": "message-reaction",
        "conversation_id": body.conversation_id,
        "message_id": result["message_id"],
        "reactions": result["reactions"],
    })
    return result


@router.post("/poll-vote")
async def vote_on_poll(body: PollVoteIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"msg-poll:{current['user_id']}", max_hits=60, window_sec=60):
        logger.warning(f"rate-limit poll-vote user={current['user_id']}")
        raise HTTPException(429, "Too many poll votes, please slow down")

    result = await set_poll_vote(
        user_id=current["user_id"],
        conversation_id=body.conversation_id,
        message_id=body.message_id,
        option_index=body.option_index,
    )
    await broadcast_to_conversation(body.conversation_id, {
        "type": "poll-vote",
        "conversation_id": body.conversation_id,
        "message_id": result["message_id"],
        "poll_votes": result["poll_votes"],
    })
    return result


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