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
    push_rich_labels: bool | None = None


def _merged_privacy_settings(user: dict | None) -> dict:
    return {
        **default_privacy_settings(),
        **((user or {}).get("privacy_settings") or {}),
    }


@router.get("")
async def get_privacy(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    user = await db.users.find_one({"_id": user_id}, {"privacy_settings": 1})
    settings = _merged_privacy_settings(user)
    return {"privacy_settings": settings}


@router.patch("")
async def patch_privacy(
    body: PrivacyPatch,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    user = await db.users.find_one({"_id": user_id}, {"privacy_settings": 1})
    settings = _merged_privacy_settings(user)
    updates: dict[str, object] = {}
    if body.last_seen_visible is not None:
        settings["last_seen_visible"] = body.last_seen_visible
        updates["privacy_settings.last_seen_visible"] = body.last_seen_visible
    if body.read_receipts is not None:
        settings["read_receipts"] = body.read_receipts
        updates["privacy_settings.read_receipts"] = body.read_receipts
    if body.push_rich_labels is not None:
        settings["push_rich_labels"] = body.push_rich_labels
        updates["privacy_settings.push_rich_labels"] = body.push_rich_labels
    if updates:
        await db.users.update_one({"_id": user_id}, {"$set": updates})
    return {"privacy_settings": settings}