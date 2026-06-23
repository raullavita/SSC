"""File upload and download routes."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile

from core.auth import get_current_user
from core.database import db
from core.file_access import user_can_access_file
from core.file_integrity import is_encrypted_upload_flag, require_encrypted_file_record, require_encrypted_upload
from core.file_validation import validate_upload
from core.files import load_file_gridfs, save_file_gridfs
from core.logging_config import logger
from core.retention import expires_at_from_now
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    encrypted: Optional[str] = Form(None),
    original_content_type: Optional[str] = Form(None),
    current=Depends(get_current_user),
):
    require_encrypted_upload(encrypted)
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "File too large (25MB max)")
    is_encrypted = is_encrypted_upload_flag(encrypted)
    if is_encrypted:
        ok, err, normalized_type = True, "", "application/octet-stream"
    else:
        ok, err, normalized_type = validate_upload(data, file.content_type)
    if not ok:
        raise HTTPException(400, err)
    if not rate_limit_check(f"file:{current['user_id']}", max_hits=5, window_sec=60):
        logger.warning(f"rate-limit file-upload user={current['user_id']}")
        raise HTTPException(429, "Too many file uploads recently")
    file_id = await save_file_gridfs(
        data,
        file.filename or "file.bin",
        normalized_type,
    )
    expires = expires_at_from_now()
    record = {
        "file_id": file_id,
        "owner_id": current["user_id"],
        "original_filename": file.filename,
        "content_type": normalized_type,
        "original_content_type": (original_content_type or normalized_type) if is_encrypted else normalized_type,
        "encrypted": is_encrypted,
        "size": len(data),
        "is_deleted": False,
        "created_at": iso(now_utc()),
        "expires_at": expires,
    }
    await db.files.insert_one(record)
    return {
        "file_id": file_id,
        "size": len(data),
        "content_type": normalized_type,
        "encrypted": is_encrypted,
    }


@router.get("/{file_id}")
async def download_file(file_id: str, current=Depends(get_current_user)):
    """Auth via Authorization header or session cookie only — never ?auth= query (Engine 2.3)."""
    user_id = current["user_id"]
    record = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found or expired")
    if not await user_can_access_file(user_id, file_id, record.get("owner_id", "")):
        raise HTTPException(403, "Not authorized to access this file")
    require_encrypted_file_record(record)
    data, ctype = await load_file_gridfs(file_id)
    return Response(content=data, media_type=record.get("content_type") or ctype)