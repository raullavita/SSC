"""
Invite links router — one-time handshake tokens.
"""
import secrets
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.database import db
from core.logging_config import logger
from core.logging_policy import token_log_ref
from core.models import CreateInviteIn
from core.retention import expires_at_from_now, friend_request_pending_expires_at, retention_hours
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


@router.post("")
async def create_invite(body: CreateInviteIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"invite:{current['user_id']}", max_hits=5, window_sec=3600):
        raise HTTPException(429, "Too many invites")
    token = secrets.token_urlsafe(16)
    hours = body.expires_hours if body.expires_hours is not None else retention_hours()
    expires = now_utc() + timedelta(hours=hours)
    await db.invites.insert_one({
        "token": token,
        "from_user_id": current["user_id"],
        "from_username": current["username"],
        "expires_at": expires,
        "used": False,
        "created_at": iso(now_utc()),
    })
    return {"token": token, "url": f"/invite/{token}", "expires_at": iso(expires)}


@router.get("/{token}/preview")
async def preview_invite(token: str):
    invite = await db.invites.find_one({"token": token, "used": False})
    if not invite:
        raise HTTPException(404, "Invalid or used invite")
    if invite["expires_at"] < now_utc():
        raise HTTPException(410, "Invite expired")
    return {
        "from_username": invite["from_username"],
        "expires_at": iso(invite["expires_at"]),
    }


@router.post("/use/{token}")
async def use_invite(token: str, current=Depends(get_current_user)):
    invite = await db.invites.find_one({"token": token, "used": False})
    if not invite:
        raise HTTPException(404, "Invalid or used invite")
    if invite["expires_at"] < now_utc():
        raise HTTPException(410, "Invite expired")
    if invite["from_user_id"] == current["user_id"]:
        raise HTTPException(400, "Cannot use your own invite")
    req_id = f"fr_{uuid.uuid4().hex[:14]}"
    await db.friend_requests.insert_one({
        "request_id": req_id,
        "from_user_id": invite["from_user_id"],
        "from_username": invite["from_username"],
        "to_user_id": current["user_id"],
        "to_username": current["username"],
        "status": "pending",
        "created_at": iso(now_utc()),
        "expires_at": friend_request_pending_expires_at(),
    })
    await db.invites.update_one(
        {"token": token},
        {"$set": {"used": True, "expires_at": expires_at_from_now()}},
    )
    logger.info(f"invite used: {token_log_ref(token)} by {current['user_id']} req={req_id}")
    return {"ok": True, "message": "Friend request sent from inviter", "request_id": req_id}