"""Broadcast lists — named recipient groups for one-to-many messaging."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.ids import new_broadcast_list_id
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/broadcast_lists", tags=["broadcast_lists"])

MAX_RECIPIENTS = 32
MAX_NAME_LEN = 80


class BroadcastListBody(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_NAME_LEN)
    recipient_ids: list[str] = Field(min_length=1, max_length=MAX_RECIPIENTS)


class BroadcastListPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=MAX_NAME_LEN)
    recipient_ids: list[str] | None = Field(default=None, min_length=1, max_length=MAX_RECIPIENTS)


def _public_list(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "name": doc.get("name", ""),
        "recipient_ids": list(doc.get("recipient_ids", [])),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


async def _validate_recipients(db, owner_id: str, recipient_ids: list[str]) -> list[str]:
    unique = []
    seen = set()
    for raw in recipient_ids:
        rid = str(raw).strip()
        if not rid or rid == owner_id or rid in seen:
            continue
        seen.add(rid)
        unique.append(rid)
    if not unique:
        raise HTTPException(status_code=400, detail="broadcast_list_needs_recipients")
    if len(unique) > MAX_RECIPIENTS:
        raise HTTPException(status_code=400, detail="broadcast_list_too_many_recipients")
    for rid in unique:
        peer = await db.users.find_one({"_id": rid})
        if not peer:
            raise HTTPException(status_code=404, detail=f"recipient_not_found:{rid}")
    return unique


@router.get("")
async def list_broadcast_lists(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    cursor = db.broadcast_lists.find({"user_id": user_id}).sort("updated_at", -1)
    items = [_public_list(doc) async for doc in cursor]
    return {"broadcast_lists": items}


@router.post("")
async def create_broadcast_list(
    body: BroadcastListBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    recipients = await _validate_recipients(db, user_id, body.recipient_ids)
    now = datetime.now(timezone.utc)
    doc = {
        "_id": new_broadcast_list_id(),
        "user_id": user_id,
        "name": body.name.strip(),
        "recipient_ids": recipients,
        "created_at": now,
        "updated_at": now,
    }
    await db.broadcast_lists.insert_one(doc)
    return {"broadcast_list": _public_list(doc)}


@router.patch("/{list_id}")
async def update_broadcast_list(
    list_id: str,
    body: BroadcastListPatch,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    existing = await db.broadcast_lists.find_one({"_id": list_id, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="broadcast_list_not_found")

    patch: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.name is not None:
        patch["name"] = body.name.strip()
    if body.recipient_ids is not None:
        patch["recipient_ids"] = await _validate_recipients(db, user_id, body.recipient_ids)

    await db.broadcast_lists.update_one({"_id": list_id}, {"$set": patch})
    doc = await db.broadcast_lists.find_one({"_id": list_id})
    return {"broadcast_list": _public_list(doc)}


@router.delete("/{list_id}")
async def delete_broadcast_list(
    list_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    result = await db.broadcast_lists.delete_one({"_id": list_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="broadcast_list_not_found")
    return {"ok": True}