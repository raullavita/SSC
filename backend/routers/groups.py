"""Group chat API — Engine 9."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.group_policy import MAX_GROUP_MEMBERS, MIN_GROUP_MEMBERS, public_group
from core.username_policy import public_user_lookup
from core.ids import new_conversation_id, new_group_id
from core.retention_policy import default_expires_at
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/groups", tags=["groups"])


class CreateGroupBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    member_ids: list[str] = Field(min_length=1, max_length=MAX_GROUP_MEMBERS)


class AddMembersBody(BaseModel):
    member_ids: list[str] = Field(min_length=1, max_length=50)


@router.post("")
async def create_group(
    body: CreateGroupBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="group_name_required")

    members = sorted(set(body.member_ids + [user_id]))
    if len(members) < MIN_GROUP_MEMBERS:
        raise HTTPException(status_code=400, detail="group_too_small")
    if len(members) > MAX_GROUP_MEMBERS:
        raise HTTPException(status_code=400, detail="group_too_large")

    db = get_database()
    for mid in members:
        if mid != user_id:
            peer = await db.users.find_one({"_id": mid})
            if not peer:
                raise HTTPException(status_code=404, detail=f"member_not_found:{mid}")

    now = datetime.now(timezone.utc)
    group_id = new_group_id()
    group_doc = {
        "_id": group_id,
        "name": name,
        "owner_id": user_id,
        "member_ids": members,
        "created_at": now,
    }
    await db.groups.insert_one(group_doc)

    for mid in members:
        await db.group_members.insert_one(
            {
                "_id": f"{group_id}:{mid}",
                "group_id": group_id,
                "user_id": mid,
                "role": "owner" if mid == user_id else "member",
                "joined_at": now,
            }
        )

    conv_id = new_conversation_id()
    conv_doc = {
        "_id": conv_id,
        "type": "group",
        "group_id": group_id,
        "participants": members,
        "created_at": now,
        "updated_at": now,
        "expires_at": default_expires_at(hours=24 * 7),
    }
    await db.conversations.insert_one(conv_doc)

    return {
        "group": public_group(group_doc, user_id),
        "conversation_id": conv_id,
    }


@router.get("/{group_id}/members")
async def list_group_members(
    group_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    group = await db.groups.find_one({"_id": group_id, "member_ids": user_id})
    if not group:
        raise HTTPException(status_code=404, detail="group_not_found")

    members = []
    for mid in group.get("member_ids", []):
        doc = await db.users.find_one({"_id": mid}, {"display_name": 1, "username": 1})
        if doc:
            members.append(public_user_lookup(doc))
    return {"group_id": group_id, "members": members}


@router.get("")
async def list_groups(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    cursor = db.groups.find({"member_ids": user_id})
    items = [public_group(doc, user_id) async for doc in cursor]
    return {"groups": items}


@router.post("/{group_id}/members")
async def add_group_members(
    group_id: str,
    body: AddMembersBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    group = await db.groups.find_one({"_id": group_id, "member_ids": user_id})
    if not group:
        raise HTTPException(status_code=404, detail="group_not_found")

    members = list(group.get("member_ids", []))
    now = datetime.now(timezone.utc)
    to_add: list[str] = []
    for mid in body.member_ids:
        if mid in members:
            continue
        peer = await db.users.find_one({"_id": mid})
        if not peer:
            raise HTTPException(status_code=404, detail=f"member_not_found:{mid}")
        to_add.append(mid)
        members.append(mid)

    if len(members) > MAX_GROUP_MEMBERS:
        raise HTTPException(status_code=400, detail="group_too_large")

    added = []
    for mid in to_add:
        added.append(mid)
        await db.group_members.insert_one(
            {
                "_id": f"{group_id}:{mid}",
                "group_id": group_id,
                "user_id": mid,
                "role": "member",
                "joined_at": now,
            }
        )

    await db.groups.update_one({"_id": group_id}, {"$set": {"member_ids": sorted(members)}})
    await db.conversations.update_one(
        {"group_id": group_id},
        {"$set": {"participants": sorted(members), "updated_at": now}},
    )

    group["member_ids"] = sorted(members)
    return {"group": public_group(group, user_id), "added": added}