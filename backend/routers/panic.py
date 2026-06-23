"""Panic wipe route — erases local data footprint, keeps the account."""
from typing import Optional

from fastapi import APIRouter, Depends, Header

from core.auth import get_current_user
from core.panic_wipe_service import execute_server_panic_wipe

router = APIRouter()


@router.post("/panic-wipe")
async def panic_wipe(
    current=Depends(get_current_user),
    authorization: Optional[str] = Header(None),
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    return await execute_server_panic_wipe(current["user_id"], session_token=token)