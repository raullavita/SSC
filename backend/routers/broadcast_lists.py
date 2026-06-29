"""Broadcast list CRUD — Q.30."""
from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.broadcast_lists import (
    MAX_BROADCAST_LISTS,
    new_broadcast_list_id,
    normalize_broadcast_list_name,
    normalize_recipient_ids,
    project_broadcast_list_for_api,
    validate_broadcast_recipients,
)
from core.database import db
from core.models import BroadcastListIn, BroadcastListUpdateIn
from core.utils import iso, now_utc

router = APIRouter()


@router.get("")
async def list_broadcast_lists(current=Depends(get_current_user)):
    rows = await db.broadcast_lists.find(
        {"owner_id": current["user_id"]},
        {"_id": 0},
    ).sort("updated_at", -1).to_list(MAX_BROADCAST_LISTS)
    return [project_broadcast_list_for_api(row) for row in rows]


@router.post("")
async def create_broadcast_list(body: BroadcastListIn, current=Depends(get_current_user)):
    count = await db.broadcast_lists.count_documents({"owner_id": current["user_id"]})
    if count >= MAX_BROADCAST_LISTS:
        raise HTTPException(400, f"You can have at most {MAX_BROADCAST_LISTS} broadcast lists")
    name = normalize_broadcast_list_name(body.name)
    recipient_ids = await validate_broadcast_recipients(
        current["user_id"],
        normalize_recipient_ids(body.recipient_ids),
    )
    ts = iso(now_utc())
    doc = {
        "list_id": new_broadcast_list_id(),
        "owner_id": current["user_id"],
        "name": name,
        "recipient_ids": recipient_ids,
        "created_at": ts,
        "updated_at": ts,
    }
    await db.broadcast_lists.insert_one(doc)
    doc.pop("_id", None)
    return project_broadcast_list_for_api(doc)


@router.patch("/{list_id}")
async def update_broadcast_list(
    list_id: str,
    body: BroadcastListUpdateIn,
    current=Depends(get_current_user),
):
    doc = await db.broadcast_lists.find_one(
        {"list_id": list_id, "owner_id": current["user_id"]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(404, "Broadcast list not found")
    patch = {"updated_at": iso(now_utc())}
    if body.name is not None:
        patch["name"] = normalize_broadcast_list_name(body.name)
    if body.recipient_ids is not None:
        patch["recipient_ids"] = await validate_broadcast_recipients(
            current["user_id"],
            normalize_recipient_ids(body.recipient_ids),
        )
    await db.broadcast_lists.update_one({"list_id": list_id}, {"$set": patch})
    updated = {**doc, **patch}
    return project_broadcast_list_for_api(updated)


@router.delete("/{list_id}")
async def delete_broadcast_list(list_id: str, current=Depends(get_current_user)):
    result = await db.broadcast_lists.delete_one(
        {"list_id": list_id, "owner_id": current["user_id"]},
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Broadcast list not found")
    return {"ok": True, "list_id": list_id}