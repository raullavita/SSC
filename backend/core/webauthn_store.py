"""Passkey credential persistence — Q.40."""
from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional

from core.database import db
from core.utils import iso, now_utc
from core.webauthn_policy import PASSKEY_MAX_PER_USER


def _b64_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64_decode(raw: str) -> bytes:
    padded = raw + "=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


async def count_user_passkeys(user_id: str) -> int:
    return await db.passkey_credentials.count_documents({"user_id": user_id})


async def list_user_passkeys(user_id: str) -> List[dict]:
    cur = db.passkey_credentials.find(
        {"user_id": user_id},
        {"_id": 0, "public_key": 0},
    ).sort("created_at", 1)
    rows = await cur.to_list(PASSKEY_MAX_PER_USER + 1)
    return [
        {
            "credential_id": row["credential_id"],
            "device_name": row.get("device_name"),
            "created_at": row.get("created_at"),
            "last_used_at": row.get("last_used_at"),
        }
        for row in rows
    ]


async def get_passkey_by_credential_id(credential_id_b64: str) -> Optional[dict]:
    return await db.passkey_credentials.find_one(
        {"credential_id": credential_id_b64},
        {"_id": 0},
    )


async def list_passkeys_for_user(user_id: str) -> List[dict]:
    cur = db.passkey_credentials.find({"user_id": user_id}, {"_id": 0})
    return await cur.to_list(PASSKEY_MAX_PER_USER + 1)


async def save_passkey(
    *,
    user_id: str,
    credential_id: bytes,
    public_key: bytes,
    sign_count: int,
    device_name: Optional[str] = None,
) -> dict:
    if await count_user_passkeys(user_id) >= PASSKEY_MAX_PER_USER:
        raise ValueError(f"Passkey limit reached (max {PASSKEY_MAX_PER_USER})")
    cred_id_b64 = _b64_encode(credential_id)
    if await get_passkey_by_credential_id(cred_id_b64):
        raise ValueError("Passkey already registered")
    doc = {
        "credential_id": cred_id_b64,
        "user_id": user_id,
        "public_key": _b64_encode(public_key),
        "sign_count": int(sign_count),
        "device_name": (device_name or "").strip() or None,
        "created_at": iso(now_utc()),
        "last_used_at": None,
    }
    await db.passkey_credentials.insert_one(doc)
    return doc


async def update_passkey_sign_count(credential_id_b64: str, sign_count: int) -> None:
    await db.passkey_credentials.update_one(
        {"credential_id": credential_id_b64},
        {"$set": {"sign_count": int(sign_count), "last_used_at": iso(now_utc())}},
    )


async def delete_user_passkey(user_id: str, credential_id_b64: str) -> bool:
    result = await db.passkey_credentials.delete_one({
        "user_id": user_id,
        "credential_id": credential_id_b64,
    })
    return result.deleted_count > 0


async def delete_all_user_passkeys(user_id: str) -> int:
    result = await db.passkey_credentials.delete_many({"user_id": user_id})
    return result.deleted_count


def credential_public_key_bytes(row: dict) -> bytes:
    return _b64_decode(row["public_key"])


def credential_id_bytes(credential_id_b64: str) -> bytes:
    return _b64_decode(credential_id_b64)