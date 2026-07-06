"""Encrypted file relay — Engine 8."""

from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.abuse_policy import MAX_FILE_BYTES, file_magic_blocked, file_rate_limiter
from core.file_policy import public_file, validate_file_ciphertext
from core.ids import new_file_id
from core.retention_policy import default_expires_at
from core.signal_policy import SIGNAL_PROTOCOL_V1
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/files", tags=["files"])


class UploadFileBody(BaseModel):
    conversation_id: str = Field(min_length=3)
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_V1)
    mime_hint: str = Field(default="application/octet-stream", max_length=128)


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


@router.post("")
async def upload_file(
    body: UploadFileBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not await file_rate_limiter.allow(f"file:{user_id}"):
        raise HTTPException(status_code=429, detail="file_rate_limited")

    ok, detail = validate_file_ciphertext(body.ciphertext, body.protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    try:
        raw = base64.b64decode(body.ciphertext, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_file_encoding") from exc

    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    if file_magic_blocked(raw[:8]):
        raise HTTPException(status_code=400, detail="file_type_blocked")

    db = get_database()
    await _require_participant(db, body.conversation_id, user_id)

    now = datetime.now(timezone.utc)
    file_id = new_file_id()
    doc = {
        "_id": file_id,
        "owner_id": user_id,
        "conversation_id": body.conversation_id,
        "ciphertext": body.ciphertext,
        "protocol": body.protocol,
        "mime_hint": body.mime_hint,
        "size_bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.files.insert_one(doc)
    return {"file": public_file(doc)}


@router.get("/{file_id}")
async def download_file(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc = await db.files.find_one({"_id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="file_not_found")
    await _require_participant(db, doc["conversation_id"], user_id)
    return {"file": public_file(doc)}