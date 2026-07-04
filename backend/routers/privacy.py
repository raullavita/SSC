"""Privacy settings — Engine 4."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.last_seen import default_privacy_settings
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/privacy", tags=["privacy"])


class PrivacyPatch(BaseModel):
    last_seen_visible: bool | None = None
    read_receipts: bool | None = None


@router.get("")
async def get_privacy(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    user = await db.users.find_one({"_id": user_id}, {"privacy_settings": 1})
    settings = (user or {}).get("privacy_settings") or default_privacy_settings()
    return {"privacy_settings": settings}


@router.patch("")
async def patch_privacy(
    body: PrivacyPatch,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    user = await db.users.find_one({"_id": user_id}, {"privacy_settings": 1})
    settings = dict((user or {}).get("privacy_settings") or default_privacy_settings())
    if body.last_seen_visible is not None:
        settings["last_seen_visible"] = body.last_seen_visible
    if body.read_receipts is not None:
        settings["read_receipts"] = body.read_receipts
    await db.users.update_one({"_id": user_id}, {"$set": {"privacy_settings": settings}})
    return {"privacy_settings": settings}