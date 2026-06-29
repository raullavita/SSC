"""Linked devices — Q.51 (Signal-style multi-device, installed clients)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from core.database import db
from core.utils import now_utc

MAX_LINKED_DEVICES = 5
LINK_TOKEN_TTL_SEC = 600
COLLECTION_DEVICES = "signal_devices"
COLLECTION_LINK_TOKENS = "device_link_tokens"


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


async def list_user_devices(user_id: str) -> List[Dict[str, Any]]:
    cursor = db[COLLECTION_DEVICES].find({"user_id": user_id}, {"_id": 0}).sort("device_id", 1)
    return [doc async for doc in cursor]


async def get_device(user_id: str, device_id: int) -> Optional[Dict[str, Any]]:
    return await db[COLLECTION_DEVICES].find_one(
        {"user_id": user_id, "device_id": device_id},
        {"_id": 0},
    )


async def touch_device(user_id: str, device_id: int, *, platform: Optional[str] = None) -> None:
    patch: Dict[str, Any] = {"last_seen_at": now_utc()}
    if platform:
        patch["platform"] = platform[:32]
    await db[COLLECTION_DEVICES].update_one(
        {"user_id": user_id, "device_id": device_id},
        {"$set": patch},
    )


async def ensure_primary_device(
    user_id: str,
    *,
    device_id: int = 1,
    platform: Optional[str] = None,
    device_name: Optional[str] = None,
) -> Dict[str, Any]:
    existing = await get_device(user_id, device_id)
    if existing:
        await touch_device(user_id, device_id, platform=platform)
        return existing
    now = now_utc()
    doc = {
        "user_id": user_id,
        "device_id": device_id,
        "device_name": (device_name or f"Device {device_id}")[:64],
        "platform": (platform or "unknown")[:32],
        "is_primary": device_id == 1,
        "created_at": now,
        "last_seen_at": now,
    }
    await db[COLLECTION_DEVICES].insert_one(doc)
    return doc


async def assign_next_device_id(user_id: str) -> int:
    devices = await list_user_devices(user_id)
    if len(devices) >= MAX_LINKED_DEVICES:
        raise ValueError("device_limit_reached")
    used = {int(d["device_id"]) for d in devices}
    for candidate in range(1, MAX_LINKED_DEVICES + 1):
        if candidate not in used:
            return candidate
    raise ValueError("device_limit_reached")


async def create_link_token(user_id: str) -> Dict[str, Any]:
    token = secrets.token_urlsafe(32)
    now = now_utc()
    expires = now + timedelta(seconds=LINK_TOKEN_TTL_SEC)
    await db[COLLECTION_LINK_TOKENS].insert_one(
        {
            "token": token,
            "user_id": user_id,
            "created_at": now,
            "expires_at": expires,
            "consumed_at": None,
        }
    )
    return {"token": token, "expires_at": _iso(expires), "expires_in_sec": LINK_TOKEN_TTL_SEC}


async def consume_link_token(
    user_id: str,
    token: str,
    *,
    platform: Optional[str] = None,
    device_name: Optional[str] = None,
) -> Dict[str, Any]:
    if not token or not token.strip():
        raise ValueError("token_required")
    doc = await db[COLLECTION_LINK_TOKENS].find_one({"token": token.strip()})
    if not doc:
        raise ValueError("invalid_token")
    if doc.get("user_id") != user_id:
        raise ValueError("token_user_mismatch")
    if doc.get("consumed_at"):
        raise ValueError("token_already_used")
    expires = doc.get("expires_at")
    if expires and expires < now_utc():
        raise ValueError("token_expired")

    device_id = await assign_next_device_id(user_id)
    now = now_utc()
    await db[COLLECTION_LINK_TOKENS].update_one(
        {"token": token.strip()},
        {"$set": {"consumed_at": now, "linked_device_id": device_id}},
    )
    device = await ensure_primary_device(
        user_id,
        device_id=device_id,
        platform=platform,
        device_name=device_name or f"Linked device {device_id}",
    )
    return {"device_id": device_id, "device": device}


async def unlink_device(user_id: str, device_id: int) -> None:
    devices = await list_user_devices(user_id)
    if len(devices) <= 1:
        raise ValueError("cannot_unlink_last_device")
    target = await get_device(user_id, device_id)
    if not target:
        raise ValueError("device_not_found")
    await db[COLLECTION_DEVICES].delete_one({"user_id": user_id, "device_id": device_id})
    await db.signal_prekey_bundles.delete_one({"user_id": user_id, "device_id": device_id})


async def migrate_legacy_single_device(user_id: str) -> None:
    """Backfill device registry + device_id on legacy single-bundle rows."""
    bundle = await db.signal_prekey_bundles.find_one({"user_id": user_id})
    if bundle and bundle.get("device_id") is None:
        await db.signal_prekey_bundles.update_one(
            {"user_id": user_id},
            {"$set": {"device_id": 1}},
        )
    if bundle:
        await ensure_primary_device(user_id, device_id=1, platform="legacy")