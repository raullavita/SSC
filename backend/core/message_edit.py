"""Edit sent message — Q.9 (15-minute window, text only, E2E ciphertext replace)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from core.database import db
from core.message_delete import is_message_deleted, message_within_retention
from core.message_replies import normalize_reply_to_message_id
from core.migration_policy import normalize_message_protocol
from core.signal_message_policy import SignalMessageValidationError, validate_send_payload
from core.utils import iso, now_utc

EDIT_WINDOW_MINUTES = 15


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def message_within_edit_window(msg: dict) -> bool:
    created = _parse_dt(msg.get("created_at"))
    if not created:
        return False
    return now_utc() <= created + timedelta(minutes=EDIT_WINDOW_MINUTES)


def is_editable_text_message(msg: Optional[dict]) -> bool:
    if not msg:
        return False
    if is_message_deleted(msg):
        return False
    if msg.get("message_type") != "text":
        return False
    if msg.get("attachment_id"):
        return False
    return True


async def edit_message_text(
    *,
    message_id: str,
    conversation_id: str,
    user_id: str,
    protocol: str,
    ciphertext: str,
    iv: Optional[str] = None,
    encrypted_keys: Optional[Dict[str, str]] = None,
    signal_message_type: Optional[int] = None,
    distribution_id: Optional[str] = None,
) -> dict:
    normalized_id = normalize_reply_to_message_id(message_id)
    msg = await db.messages.find_one(
        {"message_id": normalized_id, "conversation_id": conversation_id},
        {"_id": 0},
    )
    if not msg:
        raise HTTPException(404, "Message not found")
    if not is_editable_text_message(msg):
        raise HTTPException(400, "Only text messages can be edited")
    if msg.get("sender_id") != user_id:
        raise HTTPException(403, "Only the sender can edit this message")
    if not message_within_edit_window(msg):
        raise HTTPException(400, "Edit window expired")
    if not message_within_retention(msg):
        raise HTTPException(400, "Message retention window expired")

    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversation not found")

    try:
        normalized = validate_send_payload(
            protocol=protocol,
            ciphertext=ciphertext,
            iv=iv,
            encrypted_keys=encrypted_keys,
            signal_message_type=signal_message_type,
            is_group=bool(conv.get("is_group")),
            participant_ids=list(conv.get("participants") or []),
            attachment_id=None,
            attachment_iv=None,
            attachment_encrypted_keys=None,
            distribution_id=distribution_id,
        )
    except SignalMessageValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    existing_proto = normalize_message_protocol(msg.get("protocol"))
    if normalized["protocol"] != existing_proto:
        raise HTTPException(400, "Protocol mismatch")

    at = now_utc()
    patch = {
        "protocol": normalized["protocol"],
        "ciphertext": normalized["ciphertext"],
        "iv": normalized.get("iv"),
        "encrypted_keys": normalized.get("encrypted_keys"),
        "signal_message_type": normalized.get("signal_message_type"),
        "distribution_id": normalized.get("distribution_id"),
        "edited_at": iso(at),
        "edited_by": user_id,
    }
    await db.messages.update_one({"message_id": normalized_id}, {"$set": patch})

    out = dict(msg)
    out.update(patch)
    out.pop("_id", None)
    return out