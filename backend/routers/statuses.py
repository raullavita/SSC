"""
Statuses / Stories router.
"""
import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_helpers import are_contacts, get_mutual_contact_ids
from core.database import db
from core.logging_config import logger
from core.models import CreateStatusIn, MarkStatusViewedIn
from core.push_helpers import send_push_for_status
from core.realtime import manager
from core.api_integrity import project_status_for_viewer, sanitize_status_for_storage
from core.signal_message_policy import SignalMessageValidationError
from core.signal_policy import ProtocolVersion
from core.signal_status_policy import validate_status_payload
from core.retention import expires_at_from_now
from core.user_retention import user_retention_hours_from_doc
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


async def _user_can_view_status(user_id: str, status: dict) -> bool:
    author_id = status.get("author_id")
    if not author_id:
        return False
    if user_id == author_id:
        return True
    proto = (status.get("protocol") or ProtocolVersion.LEGACY_RSA.value).strip().lower()
    if proto == ProtocolVersion.SIGNAL_STATUS_V1.value:
        return await are_contacts(user_id, author_id)
    keys = status.get("encrypted_keys") or {}
    return user_id in keys


@router.post("")
async def create_status(body: CreateStatusIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"status:{current['user_id']}", max_hits=10, window_sec=60):
        logger.warning(f"rate-limit status user={current['user_id']}")
        raise HTTPException(429, "Too many statuses recently")

    try:
        normalized = validate_status_payload(
            protocol=body.protocol,
            ciphertext=body.ciphertext,
            iv=body.iv,
            encrypted_keys=body.encrypted_keys,
            signal_message_type=body.signal_message_type,
            distribution_id=body.distribution_id,
            author_id=current["user_id"],
        )
    except SignalMessageValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    if normalized["protocol"] == ProtocolVersion.LEGACY_RSA.value:
        enc_keys = normalized["encrypted_keys"] or {}
        if len(enc_keys) > 20 or any(len(v) > 500 for v in enc_keys.values()):
            raise HTTPException(413, "Too many or oversized encrypted keys")
        for uid in enc_keys:
            if uid != current["user_id"] and not await are_contacts(current["user_id"], uid):
                raise HTTPException(403, "Can only send status to mutual contacts")

    created = now_utc()
    expires = expires_at_from_now(user_retention_hours_from_doc(current))
    doc = sanitize_status_for_storage({
        "status_id": f"s_{uuid.uuid4().hex[:14]}",
        "author_id": current["user_id"],
        "author_username": current["username"],
        "protocol": normalized["protocol"],
        "ciphertext": normalized["ciphertext"],
        "iv": normalized["iv"],
        "encrypted_keys": normalized["encrypted_keys"],
        "signal_message_type": normalized["signal_message_type"],
        "distribution_id": normalized.get("distribution_id"),
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

    notify_ids: list[str] = []
    if normalized["protocol"] == ProtocolVersion.SIGNAL_STATUS_V1.value:
        notify_ids = await get_mutual_contact_ids(current["user_id"])
    else:
        notify_ids = [
            uid for uid in (normalized["encrypted_keys"] or {}).keys()
            if uid != current["user_id"]
        ]

    for uid in notify_ids:
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
    contact_ids = await get_mutual_contact_ids(current["user_id"])
    audience = list(set(contact_ids + [current["user_id"]]))
    cur = db.statuses.find(
        {
            "$or": [
                {f"encrypted_keys.{current['user_id']}": {"$exists": True}},
                {
                    "protocol": ProtocolVersion.SIGNAL_STATUS_V1.value,
                    "author_id": {"$in": audience},
                },
            ]
        },
        {"_id": 0},
    ).sort("created_at", -1).limit(200)
    items = await cur.to_list(200)
    me_id = current["user_id"]
    visible = [it for it in items if await _user_can_view_status(me_id, it)]
    author_ids = list({it.get("author_id") for it in visible if it.get("author_id")})
    avatar_by_id = {}
    if author_ids:
        from core.contact_helpers import are_contacts
        from core.last_seen import project_user_for_peer

        cur_users = db.users.find(
            {"user_id": {"$in": author_ids}},
            {"_id": 0, "user_id": 1, "avatar": 1, "privacy": 1},
        )
        async for u in cur_users:
            is_contact = await are_contacts(me_id, u["user_id"])
            projected = project_user_for_peer(u, viewer_is_contact=is_contact)
            if projected and projected.get("avatar"):
                avatar_by_id[u["user_id"]] = projected["avatar"]
    out = []
    for it in visible:
        row = project_status_for_viewer(it, me_id)
        aid = row.get("author_id")
        if aid and aid in avatar_by_id:
            row["author_avatar"] = avatar_by_id[aid]
        out.append(row)
    return out


@router.post("/viewed")
async def mark_status_viewed(body: MarkStatusViewedIn, current=Depends(get_current_user)):
    status = await db.statuses.find_one({"status_id": body.status_id}, {"_id": 0})
    if not status or not await _user_can_view_status(current["user_id"], status):
        raise HTTPException(404, "Status not found or not authorized")
    await db.statuses.update_one(
        {"status_id": body.status_id},
        {"$addToSet": {"viewers": current["user_id"]}},
    )
    return {"ok": True}


@router.delete("/{status_id}")
async def delete_status(status_id: str, current=Depends(get_current_user)):
    res = await db.statuses.delete_one({"status_id": status_id, "author_id": current["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Status not found")
    return {"ok": True}