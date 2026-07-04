"""Ephemeral typing indicators — no DB persistence — Engine 12."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

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

    await ws_hub.publish(
        f"conversation:{conversation_id}",
        {
            "type": "typing",
            "user_id": user_id,
            "active": body.active,
        },
    )
    return {"ok": True}