"""Multi-device linking API — Engine 9."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.ids import new_link_token_id
from core.multi_device_policy import (
    MAX_DEVICES_PER_USER,
    build_device_link_deep_link,
    build_device_link_path,
    link_token_expires_at,
    link_ttl_seconds,
    new_link_token,
    public_linked_device,
)
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/devices/link", tags=["devices"])


class CreateLinkBody(BaseModel):
    device_name: str = Field(default="New device", max_length=64)


class ConfirmLinkBody(BaseModel):
    link_token: str = Field(min_length=16)
    device_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=64)
    platform: str = Field(default="electron", max_length=32)


@router.post("")
async def create_device_link(
    body: CreateLinkBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    count = 0
    async for _ in db.devices.find({"user_id": user_id}):
        count += 1
    if count >= MAX_DEVICES_PER_USER:
        raise HTTPException(status_code=400, detail="device_limit_reached")

    token = new_link_token()
    doc = {
        "_id": new_link_token_id(),
        "user_id": user_id,
        "token": token,
        "device_name": body.device_name.strip(),
        "expires_at": link_token_expires_at(),
        "created_at": datetime.now(timezone.utc),
        "used": False,
    }
    await db.device_link_tokens.insert_one(doc)
    return {
        "link_token": token,
        "link_path": build_device_link_path(token),
        "deep_link": build_device_link_deep_link(token),
        "expires_at": doc["expires_at"].isoformat(),
        "expires_in_seconds": link_ttl_seconds(),
        "max_devices": MAX_DEVICES_PER_USER,
    }


@router.post("/confirm")
async def confirm_device_link(
    body: ConfirmLinkBody,
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc = await db.device_link_tokens.find_one({"token": body.link_token, "used": False})
    if not doc:
        raise HTTPException(status_code=404, detail="link_token_invalid")
    if doc["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="link_token_expired")

    user_id = doc["user_id"]
    count = 0
    async for _ in db.devices.find({"user_id": user_id}):
        count += 1
    if count >= MAX_DEVICES_PER_USER:
        raise HTTPException(status_code=400, detail="device_limit_reached")

    doc_id = f"{user_id}:{body.device_id}"
    now = datetime.now(timezone.utc)
    device_doc = {
        "_id": doc_id,
        "user_id": user_id,
        "device_id": body.device_id,
        "name": body.name.strip(),
        "platform": body.platform,
        "created_at": now,
        "last_active": now,
        "linked_via": "qr_token",
    }
    await db.devices.insert_one(device_doc)
    await db.device_link_tokens.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})

    return {
        "ok": True,
        "user_id": user_id,
        "device": public_linked_device(device_doc),
    }