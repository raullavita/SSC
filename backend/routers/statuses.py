"""
Statuses / Stories router.
"""
import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_helpers import are_contacts
from core.database import db
from core.logging_config import logger
from core.models import CreateStatusIn, MarkStatusViewedIn
from core.push_helpers import send_push_for_status
from core.realtime import manager
from core.api_integrity import project_status_for_viewer, sanitize_status_for_storage
from core.retention import expires_at_from_now
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


@router.post("")
async def create_status(body: CreateStatusIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"status:{current['user_id']}", max_hits=10, window_sec=60):
        logger.warning(f"rate-limit status user={current['user_id']}")
        raise HTTPException(429, "Too many statuses recently")

    if current["user_id"] not in body.encrypted_keys:
        raise HTTPException(400, "encrypted_keys must include author")
    if len(body.encrypted_keys) > 20 or any(len(v) > 500 for v in body.encrypted_keys.values()):
        raise HTTPException(413, "Too many or oversized encrypted keys")
    for uid in body.encrypted_keys:
        if uid != current["user_id"] and not await are_contacts(current["user_id"], uid):
            raise HTTPException(403, "Can only send status to mutual contacts")

    created = now_utc()
    expires = expires_at_from_now()
    doc = sanitize_status_for_storage({
        "status_id": f"s_{uuid.uuid4().hex[:14]}",
        "author_id": current["user_id"],
        "author_username": current["username"],
        "ciphertext": body.ciphertext,
        "iv": body.iv,
        "encrypted_keys": body.encrypted_keys,
        "status_type": body.status_type,
        "attachment_id": body.attachment_id,
        "background": body.background or "#1E2A38",
        "viewers": [],
        "created_at": iso(created),
        "expires_at": expires,
    })
    await db.statuses.insert_one(doc)
    doc["expires_at"] = iso(expires)
    doc.pop("_id", None)
    for uid in body.encrypted_keys.keys():
        if uid != current["user_id"]:
            await manager.send_to_user(uid, {
                "type": "status-new",
                "data": {
                    "status_id": doc["status_id"],
                    "author_id": current["user_id"],
                    "author_username": current["username"],
                },
            })
            asyncio.create_task(send_push_for_status(uid, current))
    return project_status_for_viewer(doc, current["user_id"])


@router.get("")
async def list_statuses(current=Depends(get_current_user)):
    cur = db.statuses.find(
        {f"encrypted_keys.{current['user_id']}": {"$exists": True}}, {"_id": 0}
    ).sort("created_at", -1).limit(200)
    items = await cur.to_list(200)
    me_id = current["user_id"]
    return [project_status_for_viewer(it, me_id) for it in items]


@router.post("/viewed")
async def mark_status_viewed(body: MarkStatusViewedIn, current=Depends(get_current_user)):
    res = await db.statuses.update_one(
        {"status_id": body.status_id, f"encrypted_keys.{current['user_id']}": {"$exists": True}},
        {"$addToSet": {"viewers": current["user_id"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Status not found or not authorized")
    return {"ok": True}


@router.delete("/{status_id}")
async def delete_status(status_id: str, current=Depends(get_current_user)):
    res = await db.statuses.delete_one({"status_id": status_id, "author_id": current["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Status not found")
    return {"ok": True}