"""Linked devices API — Q.51."""
from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.device_policy import (
    MAX_LINKED_DEVICES,
    create_link_token,
    consume_link_token,
    list_user_devices,
    touch_device,
    unlink_device,
    migrate_legacy_single_device,
)
from core.models import DeviceLinkConsumeIn, DeviceLinkTokenOut, DeviceRegisterIn
from core.utils import iso
from security import rate_limit_check

router = APIRouter()


@router.get("")
async def get_my_devices(current=Depends(get_current_user)):
    await migrate_legacy_single_device(current["user_id"])
    devices = await list_user_devices(current["user_id"])
    return {
        "devices": [
            {
                "device_id": d["device_id"],
                "device_name": d.get("device_name"),
                "platform": d.get("platform"),
                "is_primary": bool(d.get("is_primary")),
                "created_at": iso(d["created_at"]) if d.get("created_at") else None,
                "last_seen_at": iso(d["last_seen_at"]) if d.get("last_seen_at") else None,
            }
            for d in devices
        ],
        "max_devices": MAX_LINKED_DEVICES,
    }


@router.post("/register")
async def register_this_device(body: DeviceRegisterIn, current=Depends(get_current_user)):
    """Claim or confirm local device_id after prekey upload / link."""
    from core.device_policy import ensure_primary_device, get_device

    user_id = current["user_id"]
    device_id = int(body.device_id)
    if device_id < 1 or device_id > MAX_LINKED_DEVICES:
        raise HTTPException(400, "device_id out of range")
    existing = await get_device(user_id, device_id)
    if not existing and device_id != 1:
        raise HTTPException(400, "Device not linked — use /devices/link first")
    device = await ensure_primary_device(
        user_id,
        device_id=device_id,
        platform=body.platform,
        device_name=body.device_name,
    )
    return {
        "device_id": device["device_id"],
        "device_name": device.get("device_name"),
        "is_primary": bool(device.get("is_primary")),
    }


@router.post("/link-token", response_model=DeviceLinkTokenOut)
async def issue_link_token(current=Depends(get_current_user)):
    if not rate_limit_check(f"device_link_token:{current['user_id']}", max_hits=10, window_sec=3600):
        raise HTTPException(429, "Too many link tokens")
    await migrate_legacy_single_device(current["user_id"])
    payload = await create_link_token(current["user_id"])
    return DeviceLinkTokenOut(**payload)


@router.post("/link")
async def link_device(body: DeviceLinkConsumeIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"device_link:{current['user_id']}", max_hits=20, window_sec=3600):
        raise HTTPException(429, "Too many link attempts")
    try:
        result = await consume_link_token(
            current["user_id"],
            body.token,
            platform=body.platform,
            device_name=body.device_name,
        )
    except ValueError as exc:
        code = str(exc)
        status = 400
        if code in ("token_expired", "token_already_used", "invalid_token"):
            status = 410 if code == "token_expired" else 400
        raise HTTPException(status, code) from exc
    return {
        "status": "linked",
        "device_id": result["device_id"],
        "device": {
            "device_id": result["device"]["device_id"],
            "device_name": result["device"].get("device_name"),
            "platform": result["device"].get("platform"),
        },
    }


@router.delete("/{device_id}")
async def remove_device(device_id: int, current=Depends(get_current_user)):
    try:
        await unlink_device(current["user_id"], device_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"status": "unlinked", "device_id": device_id}