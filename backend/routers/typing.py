"""Ephemeral typing indicators — no DB persistence — Engine 12."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.conversation_privacy_policy import effective_typing_visible
from core.last_seen import default_privacy_settings
from core.ws_hub import ws_hub
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(tags=["typing"])


class TypingBody(BaseModel):
    active: bool = True


@router.post("/conversations/{conversation_id}/typing")
async def send_typing(
    conversation_id: str,
    body: TypingBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    conv = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not conv:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    user = await db.users.find_one({"_id": user_id}, {"privacy_settings": 1})
    settings = (user or {}).get("privacy_settings") or default_privacy_settings()
    meta = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    if not effective_typing_visible(settings, meta):
        return {"ok": True, "suppressed": True}

    await ws_hub.publish(
        f"conversation:{conversation_id}",
        {
            "type": "typing",
            "user_id": user_id,
            "active": body.active,
        },
    )
    return {"ok": True}