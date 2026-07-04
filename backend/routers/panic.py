"""Panic wipe API — immediate full data deletion for authenticated user."""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from core.panic_wipe import panic_wipe_user_and_report
from db import get_database

router = APIRouter(prefix="/panic", tags=["panic"])


@router.post("/wipe")
async def panic_wipe(
    x_ssc_user_id: str | None = Header(default=None, alias="X-SSC-User-Id"),
) -> dict:
    """
    Immediately delete all server-side data for the requesting user.
    Auth will bind to session cookie in Engine 5; header used until then.
    """
    if not x_ssc_user_id or not x_ssc_user_id.strip():
        raise HTTPException(
            status_code=401,
            detail="authentication_required: provide X-SSC-User-Id until session auth ships",
        )

    user_id = x_ssc_user_id.strip()
    db = get_database()
    report = await panic_wipe_user_and_report(db, user_id)
    return {"ok": True, **report}