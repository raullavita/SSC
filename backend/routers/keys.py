"""Signal prekey bundle relay — Engine 8.3. Public keys only."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_helpers import are_contacts
from core.database import db
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

    now = now_utc()
    record = {
        **doc,
        "user_id": current["user_id"],
        "libsignal_version": version or LIBSIGNAL_PINNED_VERSION,
        "updated_at": now,
        "created_at": now,
    }

    existing = await db.signal_prekey_bundles.find_one({"user_id": current["user_id"]})
    if existing:
        record["created_at"] = existing.get("created_at", now)
        await db.signal_prekey_bundles.update_one({"user_id": current["user_id"]}, {"$set": record})
    else:
        await db.signal_prekey_bundles.insert_one(record)

    await db.users.update_one(
        {"user_id": current["user_id"]},
        {
            "$set": {
                "signal_identity_key_public": doc["identity_key_public"],
                "signal_prekeys_ready": True,
                "identity_primary": "signal_v1",
                "unified_identity_at": now,
            }
        },
    )

    return {
        "status": "ok",
        "user_id": current["user_id"],
        "one_time_prekeys": len(doc["one_time_prekeys"]),
        "libsignal_version": record["libsignal_version"],
        "updated_at": iso(record["updated_at"]),
    }


@router.get("/prekey-bundle/me")
async def get_my_prekey_bundle(current=Depends(get_current_user)):
    doc = await db.signal_prekey_bundles.find_one({"user_id": current["user_id"]}, {"_id": 0})
    if not doc:
        return {"ready": False}
    return {"ready": True, **public_bundle_response(doc, current["user_id"])}


@router.get("/prekey-bundle/{user_id}")
async def get_peer_prekey_bundle(user_id: str, current=Depends(get_current_user)):
    if user_id == current["user_id"]:
        raise HTTPException(400, "use /prekey-bundle/me for your own bundle")
    if not await are_contacts(current["user_id"], user_id):
        raise HTTPException(403, "Prekey bundle only available for contacts")

    doc = await db.signal_prekey_bundles.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Peer has not uploaded Signal prekeys yet")

    patch, consumed = consume_one_time_prekey(doc)
    one_time = [consumed] if consumed else []
    if patch:
        await db.signal_prekey_bundles.update_one({"user_id": user_id}, {"$set": patch})

    return public_bundle_response(doc, user_id, one_time_override=one_time)