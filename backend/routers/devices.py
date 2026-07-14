"""Device registry — Engine 8 multi-device support."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.device_id_policy import is_valid_device_id
from core.multi_device_policy import MAX_DEVICES_PER_USER, public_linked_device
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/devices", tags=["devices"])


class RegisterDeviceBody(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=64)
    platform: str = Field(default="electron", max_length=32)


@router.post("")
async def register_device(
    body: RegisterDeviceBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not is_valid_device_id(body.device_id):
        raise HTTPException(status_code=400, detail="device_id_must_be_numeric")

    db = get_database()
    doc_id = f"{user_id}:{body.device_id}"
    now = datetime.now(timezone.utc)
    doc = {
        "_id": doc_id,
        "user_id": user_id,
        "device_id": body.device_id,
        "name": body.name.strip(),
        "platform": body.platform,
        "created_at": now,
        "last_active": now,
    }
    existing = await db.devices.find_one({"_id": doc_id})
    if not existing:
        count = 0
        async for _ in db.devices.find({"user_id": user_id}):
            count += 1
        if count >= MAX_DEVICES_PER_USER:
            raise HTTPException(status_code=400, detail="device_limit_reached")
    if existing:
        await db.devices.update_one(
            {"_id": doc_id},
            {"$set": {"name": doc["name"], "platform": doc["platform"], "last_active": now}},
        )
    else:
        await db.devices.insert_one(doc)
    saved = await db.devices.find_one({"_id": doc_id})
    return {"device": public_linked_device(saved or doc)}


@router.get("")
async def list_devices(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    cursor = db.devices.find({"user_id": user_id})
    items = [public_linked_device(d) async for d in cursor]
    return {"devices": items}


@router.delete("/{device_id}")
async def revoke_device(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc_id = f"{user_id}:{device_id}"
    result = await db.devices.delete_many({"_id": doc_id, "user_id": user_id})
    await db.prekeys.delete_many({"_id": doc_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="device_not_found")
    return {"ok": True, "device_id": device_id}