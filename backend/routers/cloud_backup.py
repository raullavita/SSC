"""Encrypted cloud backup — client-encrypted blob stored server-side (ciphertext only)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.cloud_backup_policy import MAX_CLOUD_BACKUP_BYTES
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(tags=["cloud_backup"])


class CloudBackupPutBody(BaseModel):
    ciphertext: str = Field(min_length=32, max_length=MAX_CLOUD_BACKUP_BYTES)


@router.get("/backup/cloud")
async def get_cloud_backup(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc = await db.user_cloud_backups.find_one({"_id": user_id})
    if not doc:
        return {"has_backup": False, "backup": None}
    return {
        "has_backup": True,
        "backup": {
            "updated_at": doc.get("updated_at"),
            "size_bytes": doc.get("size_bytes", 0),
            "ciphertext": doc.get("ciphertext"),
        },
    }


@router.put("/backup/cloud")
async def put_cloud_backup(
    body: CloudBackupPutBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    raw = body.ciphertext.encode("utf-8")
    if len(raw) > MAX_CLOUD_BACKUP_BYTES:
        raise HTTPException(status_code=413, detail="cloud_backup_too_large")

    now = datetime.now(timezone.utc)
    db = get_database()
    await db.user_cloud_backups.update_one(
        {"_id": user_id},
        {
            "$set": {
                "ciphertext": body.ciphertext,
                "size_bytes": len(raw),
                "updated_at": now,
            }
        },
        upsert=True,
    )
    return {"ok": True, "updated_at": now.isoformat(), "size_bytes": len(raw)}


@router.delete("/backup/cloud")
async def delete_cloud_backup(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    result = await db.user_cloud_backups.delete_one({"_id": user_id})
    return {"ok": True, "deleted": result.deleted_count > 0}