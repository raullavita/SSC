"""User profile and search routes."""
import base64
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from core.auth import get_current_user
from core.contact_helpers import get_user_public
from core.database import db
from core.models import UpdateProfileIn
from core.retention_db import refresh_retention_after_user_change
from core.user_retention import normalize_user_retention_hours, user_retention_hours_from_doc
from core.bio_policy import normalize_bio
from core.display_name_policy import normalize_display_name
from core.privacy_settings import merge_privacy, normalize_privacy_patch, privacy_from_user
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
    if body.display_name is not None:
        try:
            new_name = normalize_display_name(body.display_name)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        current_name = (current.get("display_name") or "").strip() or None
        if new_name != current_name:
            update["display_name"] = new_name
    if body.bio is not None:
        try:
            new_bio = normalize_bio(body.bio)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        current_bio = (current.get("bio") or "").strip() or None
        if new_bio != current_bio:
            update["bio"] = new_bio
    if body.language:
        update["language"] = body.language
    if body.retention_hours is not None:
        try:
            new_hours = normalize_user_retention_hours(body.retention_hours)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        current_hours = user_retention_hours_from_doc(current)
        if new_hours != current_hours:
            update["retention_hours"] = new_hours
    if body.privacy is not None:
        try:
            patch = normalize_privacy_patch(body.privacy.model_dump(exclude_unset=True))
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        if patch:
            merged = merge_privacy(current.get("privacy"), patch)
            if merged != privacy_from_user(current):
                update["privacy"] = merged
    if update:
        await db.users.update_one({"user_id": current["user_id"]}, {"$set": update})
        if "retention_hours" in update:
            await refresh_retention_after_user_change(current["user_id"])
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
    from core.contact_helpers import are_contacts
    from core.last_seen import project_user_for_peer

    needle = re.escape(q)
    cur = db.users.find(
        {
            "user_id": {"$ne": current["user_id"]},
            "$or": [
                {"username": {"$regex": f"^{needle}", "$options": "i"}},
                {"display_name": {"$regex": needle, "$options": "i"}},
            ],
        },
        {"_id": 0, "password_hash": 0, "totp_secret": 0, "totp_pending_secret": 0},
    ).limit(20)
    rows = await cur.to_list(20)
    out = []
    for row in rows:
        is_contact = await are_contacts(current["user_id"], row["user_id"])
        projected = project_user_for_peer(row, viewer_is_contact=is_contact)
        if projected:
            out.append({
                "user_id": projected.get("user_id"),
                "username": projected.get("username"),
                "display_name": projected.get("display_name"),
                "bio": projected.get("bio"),
                "language": projected.get("language"),
                "avatar": projected.get("avatar"),
                "public_key": projected.get("public_key"),
                "signal_prekeys_ready": projected.get("signal_prekeys_ready"),
            })
    return out


@router.get("/{user_id}/public")
async def get_user_public_route(user_id: str, current=Depends(get_current_user)):
    u = await get_user_public(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    return u