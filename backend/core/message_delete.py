"""Delete for everyone / unsend — Q.8 (within retention window)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from core.database import db
from core.files import delete_file_gridfs
from core.logging_config import logger
from core.message_replies import normalize_reply_to_message_id
from core.utils import iso, now_utc

DELETED_MESSAGE_TYPE = "deleted"


def is_message_deleted(msg: Optional[dict]) -> bool:
    if not msg:
        return False
    return msg.get("message_type") == DELETED_MESSAGE_TYPE or bool(msg.get("deleted_for_everyone_at"))


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


def message_within_retention(msg: dict) -> bool:
    expires = _parse_dt(msg.get("expires_at"))
    if not expires:
        return False
    return expires > now_utc()


def tombstone_update(deleted_by: str, at: Optional[datetime] = None) -> Dict[str, Any]:
    ts = at or now_utc()
    return {
        "message_type": DELETED_MESSAGE_TYPE,
        "deleted_for_everyone_at": iso(ts),
        "deleted_by": deleted_by,
        "ciphertext": "",
        "iv": None,
        "encrypted_keys": {},
        "signal_message_type": None,
        "distribution_id": None,
        "attachment_id": None,
        "attachment_iv": None,
        "attachment_encrypted_keys": None,
        "attachment_content_type": None,
    }


async def _delete_attachment(attachment_id: Optional[str]) -> None:
    if not attachment_id:
        return
    record = await db.files.find_one(
        {"file_id": attachment_id, "is_deleted": False},
        {"_id": 0},
    )
    if not record:
        return
    try:
        await delete_file_gridfs(attachment_id)
    except Exception as exc:
        logger.warning(f"unsend gridfs delete failed file={attachment_id}: {exc}")
    await db.files.update_one({"file_id": attachment_id}, {"$set": {"is_deleted": True}})


async def unsend_message_for_everyone(
    *,
    message_id: str,
    conversation_id: str,
    user_id: str,
) -> dict:
    normalized_id = normalize_reply_to_message_id(message_id)
    msg = await db.messages.find_one(
        {"message_id": normalized_id, "conversation_id": conversation_id},
        {"_id": 0},
    )
    if not msg:
        raise HTTPException(404, "Message not found")
    if is_message_deleted(msg):
        raise HTTPException(400, "Message already deleted")
    if msg.get("sender_id") != user_id:
        raise HTTPException(403, "Only the sender can delete for everyone")
    if not message_within_retention(msg):
        raise HTTPException(400, "Message retention window expired")

    await _delete_attachment(msg.get("attachment_id"))
    patch = tombstone_update(user_id)
    await db.messages.update_one({"message_id": normalized_id}, {"$set": patch})

    out = dict(msg)
    out.update(patch)
    out.pop("_id", None)
    return out