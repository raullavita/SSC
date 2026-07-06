"""Message relay routes — Engine 9 sealed sender + multi-device fanout."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from core.abuse_enforcement import is_abuse_rate_limited, is_user_blocked
from core.abuse_policy import msg_rate_limiter
from core.new_account_policy import enforce_new_account_dm
from core.ids import new_message_id
from core.message_fanout import fanout_message, fanout_message_deleted, fanout_message_edited
from core.message_lifecycle_policy import (
    DELETE_SCOPES,
    can_delete_for_everyone,
    can_delete_for_me,
    can_edit_message,
    is_hidden_for_viewer,
    tombstone_update,
)
from core.read_receipts import increment_unread
from core.metadata_policy import public_message
from core.retention_policy import default_expires_at
from core.smart_policy import validate_disappearing_seconds
from core.sealed_sender_policy import mark_sealed
from core.attachment_policy import SIGNAL_PROTOCOL_ATTACHMENT
from core.reaction_policy import SIGNAL_PROTOCOL_REACTION
from core.signal_policy import (
    GROUP_SENDER_KEY_DIST_PROTOCOL,
    SIGNAL_PROTOCOL_V1,
    validate_protocol_for_env,
    validate_signal_ciphertext,
)
from db import get_database
from deps import get_client_header, get_current_user_id
from push import notify_conversation_participants

router = APIRouter(tags=["messages"])


class SendMessageBody(BaseModel):
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_V1)
    sealed: bool = False
    disappearing_seconds: int | None = Field(default=None, ge=60, le=86_400)
    reply_to: str | None = Field(default=None, min_length=3, max_length=64)
    forwarded_from: str | None = Field(default=None, min_length=3, max_length=64)


class EditMessageBody(BaseModel):
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_V1)


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


def _enforce_protocol_policy(protocol: str) -> None:
    ok, detail = validate_protocol_for_env(protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    now = datetime.now(timezone.utc)
    cursor = db.messages.find(
        {
            "conversation_id": conversation_id,
            "$or": [
                {"expires_at": {"$gt": now}},
                {"expires_at": None},
                {"expires_at": {"$exists": False}},
            ],
        }
    ).sort("created_at", 1)
    items = []
    async for doc in cursor:
        if is_hidden_for_viewer(doc, user_id):
            continue
        msg = public_message(doc, viewer_id=user_id)
        if msg:
            items.append(msg)
    return {"messages": items}


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageBody,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not await msg_rate_limiter.allow(f"msg:{user_id}"):
        raise HTTPException(status_code=429, detail="message_rate_limited")

    protocol = body.protocol or SIGNAL_PROTOCOL_V1
    if body.sealed and protocol == SIGNAL_PROTOCOL_V1:
        protocol = "signal_v1_sealed"
    _enforce_protocol_policy(protocol)

    ok, detail = validate_signal_ciphertext(body.ciphertext, protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    ttl_ok, ttl_detail = validate_disappearing_seconds(body.disappearing_seconds)
    if not ttl_ok:
        raise HTTPException(status_code=400, detail=ttl_detail)

    db = get_database()
    if await is_abuse_rate_limited(db, user_id):
        raise HTTPException(status_code=429, detail="abuse_rate_limited")

    conv = await _require_participant(db, conversation_id, user_id)
    await enforce_new_account_dm(db, user_id, conv)

    if conv.get("type") == "direct":
        others = [p for p in conv.get("participants", []) if p != user_id]
        if others and await is_user_blocked(db, others[0], user_id):
            raise HTTPException(status_code=403, detail="blocked_by_recipient")

    now = datetime.now(timezone.utc)
    if body.disappearing_seconds:
        expires_at = now + timedelta(seconds=body.disappearing_seconds)
    else:
        expires_at = default_expires_at()

    if protocol == SIGNAL_PROTOCOL_REACTION:
        message_kind = "reaction"
    elif protocol == SIGNAL_PROTOCOL_ATTACHMENT:
        message_kind = "attachment"
    elif protocol == GROUP_SENDER_KEY_DIST_PROTOCOL:
        message_kind = "sender_key_distribution"
    else:
        message_kind = "message"
    if body.reply_to:
        parent = await db.messages.find_one(
            {"_id": body.reply_to, "conversation_id": conversation_id}
        )
        if not parent:
            raise HTTPException(status_code=400, detail="reply_to_not_found")

    forwarded_from = None
    if body.forwarded_from:
        source = await db.messages.find_one({"_id": body.forwarded_from})
        if not source:
            raise HTTPException(status_code=400, detail="forwarded_from_not_found")
        forwarded_from = body.forwarded_from

    doc = mark_sealed(
        {
            "_id": new_message_id(),
            "conversation_id": conversation_id,
            "sender_id": user_id,
            "ciphertext": body.ciphertext,
            "protocol": protocol,
            "message_kind": message_kind,
            "reply_to": body.reply_to,
            "forwarded_from": forwarded_from,
            "created_at": now,
            "expires_at": expires_at,
            "disappearing_seconds": body.disappearing_seconds,
        },
        sealed=body.sealed or protocol == "signal_v1_sealed",
    )
    await db.messages.insert_one(doc)
    await db.conversations.update_one(
        {"_id": conversation_id},
        {"$set": {"updated_at": now}},
    )

    participants = conv.get("participants", [])
    await fanout_message(conversation_id, doc, participants, user_id)
    if message_kind != "reaction":
        await increment_unread(db, conversation_id, participants, user_id)

    background_tasks.add_task(
        notify_conversation_participants,
        participants,
        sender_id=user_id,
        conversation_id=conversation_id,
        message_id=doc["_id"],
        kind=message_kind,
        skip_kinds=frozenset({"reaction", "sender_key_distribution"}),
    )

    return {"message": public_message(doc, viewer_id=user_id)}


async def _require_message_participant(db, message_id: str, user_id: str) -> tuple[dict, dict]:
    msg = await db.messages.find_one({"_id": message_id})
    if not msg:
        raise HTTPException(status_code=404, detail="message_not_found")
    conv = await _require_participant(db, msg["conversation_id"], user_id)
    return msg, conv


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: str,
    body: EditMessageBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    protocol = body.protocol or SIGNAL_PROTOCOL_V1
    _enforce_protocol_policy(protocol)

    ok, detail = validate_signal_ciphertext(body.ciphertext, protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    db = get_database()
    msg, conv = await _require_message_participant(db, message_id, user_id)

    now = datetime.now(timezone.utc)
    allowed, reason = can_edit_message(msg, user_id, now)
    if not allowed:
        raise HTTPException(status_code=403, detail=reason)

    await db.messages.update_one(
        {"_id": message_id},
        {
            "$set": {
                "ciphertext": body.ciphertext,
                "protocol": protocol,
                "edited_at": now,
            }
        },
    )
    updated = await db.messages.find_one({"_id": message_id})
    participants = conv.get("participants", [])
    await fanout_message_edited(msg["conversation_id"], updated, participants)
    return {"message": public_message(updated, viewer_id=user_id)}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    scope: str = "me",
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if scope not in DELETE_SCOPES:
        raise HTTPException(status_code=400, detail="invalid_delete_scope")

    db = get_database()
    msg, conv = await _require_message_participant(db, message_id, user_id)
    participants = conv.get("participants", [])
    now = datetime.now(timezone.utc)

    if scope == "me":
        allowed, reason = can_delete_for_me(msg, user_id)
        if not allowed:
            raise HTTPException(status_code=403, detail=reason)
        await db.messages.update_one(
            {"_id": message_id},
            {"$addToSet": {"deleted_for": user_id}},
        )
        await fanout_message_deleted(
            msg["conversation_id"],
            message_id,
            scope,
            user_id,
            participants,
        )
        return {"deleted": True, "scope": scope, "message_id": message_id}

    allowed, reason = can_delete_for_everyone(msg, user_id, now)
    if not allowed:
        raise HTTPException(status_code=403, detail=reason)
    await db.messages.update_one(
        {"_id": message_id},
        {"$set": tombstone_update(now)},
    )
    updated = await db.messages.find_one({"_id": message_id})
    await fanout_message_deleted(
        msg["conversation_id"],
        message_id,
        scope,
        user_id,
        participants,
        doc=updated,
    )
    return {"deleted": True, "scope": scope, "message_id": message_id, "message": public_message(updated, viewer_id=user_id)}