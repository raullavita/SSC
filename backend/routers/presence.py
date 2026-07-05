"""Presence / last-seen heartbeat — Engine 4."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from core.last_seen import last_seen_for_viewer, record_user_activity
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/presence", tags=["presence"])


@router.post("/heartbeat")
async def heartbeat(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await record_user_activity(db, user_id)
    return {"ok": True}


@router.get("/users/{subject_id}")
async def get_presence(
    subject_id: str,
    conversation_id: str | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    if conversation_id:
        conv = await db.conversations.find_one(
            {"_id": conversation_id, "participants": user_id}
        )
        if not conv or subject_id not in conv.get("participants", []):
            conversation_id = None
    return await last_seen_for_viewer(
        db, subject_id, user_id, conversation_id=conversation_id
    )