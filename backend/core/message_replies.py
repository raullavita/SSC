"""Reply / quote metadata — Q.7 (message_id reference only, E2E body unchanged)."""
from __future__ import annotations

import re
from typing import Optional

from fastapi import HTTPException

from core.database import db

_MESSAGE_ID_RE = re.compile(r"^m_[a-f0-9]{14}$")


def normalize_reply_to_message_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if not _MESSAGE_ID_RE.match(raw):
        raise HTTPException(400, "Invalid reply_to_message_id")
    return raw


async def validate_reply_target(conversation_id: str, reply_to_message_id: Optional[str]) -> Optional[str]:
    normalized = normalize_reply_to_message_id(reply_to_message_id)
    if not normalized:
        return None
    ref = await db.messages.find_one(
        {"message_id": normalized, "conversation_id": conversation_id},
        {"_id": 1},
    )
    if not ref:
        raise HTTPException(400, "Reply target not found in this conversation")
    return normalized