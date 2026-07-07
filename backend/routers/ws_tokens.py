"""Short-lived WebSocket subscribe tokens — Phase 3."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from core.ws_subscribe_tokens import (
    issue_subscribe_token,
    validate_topic_for_user,
    ws_subscribe_token_required,
)
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.get("/subscribe-token")
async def get_subscribe_token(
    topic: str = Query(..., min_length=8, max_length=128),
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not await validate_topic_for_user(topic, user_id):
        raise HTTPException(status_code=403, detail="ws_subscribe_topic_forbidden")
    token = await issue_subscribe_token(user_id, topic)
    return {
        "subscribe_token": token,
        "topic": topic,
        "required": ws_subscribe_token_required(),
    }