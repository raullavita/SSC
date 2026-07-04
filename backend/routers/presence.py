"""Presence / last-seen heartbeat — Engine 4."""

from __future__ import annotations

from fastapi import APIRouter, Depends

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
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    return await last_seen_for_viewer(db, subject_id, user_id)