"""Minimal user lookup — metadata-minimized (id + display_name only)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/lookup/{target_id}")
async def lookup_user(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="cannot_lookup_self")

    db = get_database()
    doc = await db.users.find_one({"_id": target_id}, {"display_name": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="user_not_found")

    return {
        "user": {
            "id": target_id,
            "display_name": doc.get("display_name", ""),
        }
    }