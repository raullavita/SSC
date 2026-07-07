"""Public prekey bundle API — Engine 8. No private keys on server."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from config import get_settings
from core.abuse_policy import prekey_fetch_limiter
from core.abuse_enforcement import is_abuse_rate_limited
from core.prekey_policy import prekey_fetch_allowed
from core.pqxdh_policy import validate_kyber_prekey
from core.signal_policy import (
    FORBIDDEN_PREKEY_FIELDS,
    public_prekey_bundle,
    scrub_prekey_bundle,
)
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/prekeys", tags=["prekeys"])


class PreKeyEntry(BaseModel):
    key_id: int
    public_key: str = Field(min_length=8)


class SignedPreKey(BaseModel):
    key_id: int
    public_key: str = Field(min_length=8)
    signature: str = Field(min_length=8)


class PreKeyBundleBody(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    registration_id: int = Field(ge=1, le=16380)
    identity_key: str = Field(min_length=8)
    signed_prekey: SignedPreKey
    prekeys: list[PreKeyEntry] = Field(min_length=1, max_length=100)
    kyber_prekey: dict | None = None


@router.put("/bundle")
async def upload_prekey_bundle(
    body: PreKeyBundleBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    raw = body.model_dump()
    if any(field in raw for field in FORBIDDEN_PREKEY_FIELDS):
        raise HTTPException(status_code=400, detail="private_key_material_forbidden")

    settings = get_settings()
    kyber_ok, kyber_detail = validate_kyber_prekey(
        body.kyber_prekey, production=settings.is_production
    )
    if not kyber_ok:
        raise HTTPException(status_code=400, detail=kyber_detail)

    db = get_database()
    doc_id = f"{user_id}:{body.device_id}"
    doc = scrub_prekey_bundle(
        {
            "_id": doc_id,
            "user_id": user_id,
            "device_id": body.device_id,
            "registration_id": body.registration_id,
            "identity_key": body.identity_key,
            "signed_prekey": body.signed_prekey.public_key,
            "signed_prekey_id": body.signed_prekey.key_id,
            "signed_prekey_signature": body.signed_prekey.signature,
            "prekeys": [p.model_dump() for p in body.prekeys],
            "kyber_prekey": body.kyber_prekey,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    await db.prekeys.replace_one({"_id": doc_id}, doc, upsert=True)
    return {"ok": True, "bundle": public_prekey_bundle(doc)}


@router.get("/users/{target_user_id}/devices/{device_id}")
async def fetch_prekey_bundle(
    target_user_id: str,
    device_id: str,
    _client: str = Depends(get_client_header),
    viewer: str = Depends(get_current_user_id),
) -> dict:
    if not await prekey_fetch_limiter.allow(f"prekey_fetch:{viewer}:{target_user_id}:{device_id}"):
        raise HTTPException(status_code=429, detail="prekey_fetch_rate_limited")
    db = get_database()
    if await is_abuse_rate_limited(db, viewer):
        raise HTTPException(status_code=429, detail="abuse_rate_limited")
    if not await prekey_fetch_allowed(db, viewer, target_user_id):
        raise HTTPException(status_code=403, detail="prekey_fetch_not_allowed")
    doc_id = f"{target_user_id}:{device_id}"
    doc = await db.prekeys.find_one({"_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="prekey_bundle_not_found")
    return {"bundle": public_prekey_bundle(doc)}


@router.get("/users/{target_user_id}")
async def list_user_prekey_devices(
    target_user_id: str,
    _client: str = Depends(get_client_header),
    viewer: str = Depends(get_current_user_id),
) -> dict:
    if not await prekey_fetch_limiter.allow(f"prekey_list:{viewer}:{target_user_id}"):
        raise HTTPException(status_code=429, detail="prekey_fetch_rate_limited")
    db = get_database()
    if await is_abuse_rate_limited(db, viewer):
        raise HTTPException(status_code=429, detail="abuse_rate_limited")
    if not await prekey_fetch_allowed(db, viewer, target_user_id):
        raise HTTPException(status_code=403, detail="prekey_fetch_not_allowed")
    cursor = db.prekeys.find({"user_id": target_user_id})
    devices = [public_prekey_bundle(doc) async for doc in cursor]
    return {"user_id": target_user_id, "devices": devices}