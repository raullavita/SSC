"""Panic wipe API — immediate full data deletion for authenticated user."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from core.panic_wipe import panic_wipe_user_and_report
from core.token_revocation import revoke_all_user_sessions
from db import get_database
from deps import get_current_user_id

router = APIRouter(prefix="/panic", tags=["panic"])


@router.post("/wipe")
async def panic_wipe(user_id: str = Depends(get_current_user_id)) -> dict:
    """Delete all server-side data for the authenticated user and revoke sessions."""
    await revoke_all_user_sessions(user_id)
    db = get_database()
    report = await panic_wipe_user_and_report(db, user_id)
    return {"ok": True, **report}