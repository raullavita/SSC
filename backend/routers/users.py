"""User profile and search routes."""
import base64
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from core.auth import get_current_user
from core.contact_helpers import get_user_public
from core.database import db
from core.models import UpdateProfileIn
from core.utils import validate_username
from security import rate_limit_check

router = APIRouter()

_AVATAR_MAX_BYTES = 512_000
_ALLOWED_AVATAR_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


def _validate_image_bytes(data: bytes, content_type: str) -> str:
    if len(data) > _AVATAR_MAX_BYTES:
        raise HTTPException(413, "Avatar too large (max 500KB)")
    if content_type not in _ALLOWED_AVATAR_TYPES:
        raise HTTPException(400, "Avatar must be JPEG, PNG, or WebP")
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(400, "Invalid image file")


@router.patch("/me")
async def update_me(body: UpdateProfileIn, current=Depends(get_current_user)):
    update = {}
    if body.username and body.username.strip() != (current.get("username") or ""):
        raise HTTPException(403, "Username cannot be changed after registration")
    if body.language:
        update["language"] = body.language
    if update:
        await db.users.update_one({"user_id": current["user_id"]}, {"$set": update})
    user = await db.users.find_one(
        {"user_id": current["user_id"]},
        {"_id": 0, "password_hash": 0, "totp_secret": 0, "totp_pending_secret": 0},
    )
    return user


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current=Depends(get_current_user),
):
    if not rate_limit_check(f"avatar:{current['user_id']}", max_hits=5, window_sec=3600):
        raise HTTPException(429, "Too many avatar uploads")
    data = await file.read()
    mime = _validate_image_bytes(data, (file.content_type or "").split(";")[0].strip().lower())
    avatar = f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {"avatar": avatar}})
    return {"ok": True, "avatar": avatar}


@router.delete("/me/avatar")
async def remove_avatar(current=Depends(get_current_user)):
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {"avatar": None}})
    return {"ok": True}


@router.get("/search")
async def search_users(q: str, current=Depends(get_current_user)):
    if not rate_limit_check(f"search:{current['user_id']}", max_hits=20, window_sec=60):
        raise HTTPException(429, "Too many searches")
    if not q or len(q) < 2:
        return []
    cur = db.users.find(
        {"username": {"$regex": f"^{re.escape(q)}", "$options": "i"}, "user_id": {"$ne": current["user_id"]}},
        {"_id": 0, "user_id": 1, "username": 1, "language": 1, "avatar": 1, "public_key": 1, "signal_prekeys_ready": 1},
    ).limit(20)
    return await cur.to_list(20)


@router.get("/{user_id}/public")
async def get_user_public_route(user_id: str, current=Depends(get_current_user)):
    u = await get_user_public(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    return u