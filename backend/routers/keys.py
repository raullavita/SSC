"""Signal prekey bundle relay — Engine 8.3 + Q.51 multi-device."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import get_current_user
from core.contact_helpers import are_contacts
from core.contact_realtime import notify_signal_identity_changed
from core.database import db
from core.device_policy import ensure_primary_device, migrate_legacy_single_device, touch_device
from core.models import PrekeyBundleIn
from core.prekey_bundle import (
    PrekeyValidationError,
    consume_one_time_prekey,
    public_bundle_response,
    sanitize_bundle_payload,
)
from core.signal_policy import LIBSIGNAL_PINNED_VERSION
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


async def _store_prekey_bundle(user_id: str, doc: dict, device_id: int) -> dict:
    now = now_utc()
    record = {
        **doc,
        "user_id": user_id,
        "device_id": device_id,
        "libsignal_version": (doc.get("libsignal_version") or "").strip() or LIBSIGNAL_PINNED_VERSION,
        "updated_at": now,
    }
    existing = await db.signal_prekey_bundles.find_one({"user_id": user_id, "device_id": device_id})
    prior_identity = (existing or {}).get("identity_key_public")
    identity_rotated = bool(prior_identity and prior_identity != doc["identity_key_public"])
    if existing:
        record["created_at"] = existing.get("created_at", now)
        await db.signal_prekey_bundles.update_one(
            {"user_id": user_id, "device_id": device_id},
            {"$set": record},
        )
    else:
        record["created_at"] = now
        await db.signal_prekey_bundles.insert_one(record)

    if identity_rotated:
        await notify_signal_identity_changed(
            user_id,
            identity_key_public=doc["identity_key_public"],
        )

    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "signal_identity_key_public": doc["identity_key_public"],
                "signal_prekeys_ready": True,
                "identity_primary": "signal_v1",
                "unified_identity_at": now,
            }
        },
    )
    return record


@router.put("/prekey-bundle")
async def upload_prekey_bundle(body: PrekeyBundleIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"prekey_upload:{current['user_id']}", max_hits=10, window_sec=3600):
        raise HTTPException(429, "Too many prekey uploads")

    try:
        doc = sanitize_bundle_payload(body.model_dump())
    except PrekeyValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    version = (doc.get("libsignal_version") or "").strip()
    if version and version != LIBSIGNAL_PINNED_VERSION:
        raise HTTPException(400, f"libsignal_version must be {LIBSIGNAL_PINNED_VERSION}")

    device_id = int(doc["device_id"])
    await migrate_legacy_single_device(current["user_id"])
    await ensure_primary_device(current["user_id"], device_id=device_id)
    record = await _store_prekey_bundle(current["user_id"], doc, device_id)
    await touch_device(current["user_id"], device_id)

    return {
        "status": "ok",
        "user_id": current["user_id"],
        "device_id": device_id,
        "one_time_prekeys": len(doc["one_time_prekeys"]),
        "libsignal_version": record["libsignal_version"],
        "updated_at": iso(record["updated_at"]),
    }


@router.get("/prekey-bundle/me")
async def get_my_prekey_bundle(
    device_id: int = Query(default=1, ge=1, le=5),
    current=Depends(get_current_user),
):
    await migrate_legacy_single_device(current["user_id"])
    doc = await db.signal_prekey_bundles.find_one(
        {"user_id": current["user_id"], "device_id": device_id},
        {"_id": 0},
    )
    if not doc:
        return {"ready": False, "device_id": device_id}
    return {"ready": True, "device_id": device_id, **public_bundle_response(doc, current["user_id"])}


@router.get("/prekey-bundles/{user_id}")
async def get_peer_prekey_bundles(user_id: str, current=Depends(get_current_user)):
    if user_id == current["user_id"]:
        raise HTTPException(400, "use /prekey-bundle/me for your own bundle")
    if not await are_contacts(current["user_id"], user_id):
        raise HTTPException(403, "Prekey bundle only available for contacts")

    cursor = db.signal_prekey_bundles.find({"user_id": user_id}, {"_id": 0}).sort("device_id", 1)
    bundles = [doc async for doc in cursor]
    if not bundles:
        raise HTTPException(404, "Peer has not uploaded Signal prekeys yet")

    devices = []
    for doc in bundles:
        patch, consumed = consume_one_time_prekey(doc)
        one_time = [consumed] if consumed else []
        if patch:
            await db.signal_prekey_bundles.update_one(
                {"user_id": user_id, "device_id": doc.get("device_id", 1)},
                {"$set": patch},
            )
        devices.append(
            public_bundle_response(doc, user_id, one_time_override=one_time),
        )
    return {"user_id": user_id, "devices": devices}


@router.get("/prekey-bundle/{user_id}")
async def get_peer_prekey_bundle(
    user_id: str,
    device_id: int = Query(default=1, ge=1, le=5),
    current=Depends(get_current_user),
):
    if user_id == current["user_id"]:
        raise HTTPException(400, "use /prekey-bundle/me for your own bundle")
    if not await are_contacts(current["user_id"], user_id):
        raise HTTPException(403, "Prekey bundle only available for contacts")

    doc = await db.signal_prekey_bundles.find_one(
        {"user_id": user_id, "device_id": device_id},
        {"_id": 0},
    )
    if not doc:
        doc = await db.signal_prekey_bundles.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Peer has not uploaded Signal prekeys yet")

    patch, consumed = consume_one_time_prekey(doc)
    one_time = [consumed] if consumed else []
    if patch:
        await db.signal_prekey_bundles.update_one(
            {"user_id": user_id, "device_id": doc.get("device_id", 1)},
            {"$set": patch},
        )

    return public_bundle_response(doc, user_id, one_time_override=one_time)