"""Account recovery keys — Argon2id hash-only storage — Phase 2."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from core.captcha import verify_captcha
from core.passwords import hash_password
from core.recovery_crypto import hash_recovery_passphrase, needs_rehash, verify_recovery_passphrase
from core.recovery_policy import RECOVERY_KEY_MAX_LEN, RECOVERY_KEY_MIN_LEN
from core.session_issue import issue_user_session
from core.short_lived_tokens import issue_token, consume_token
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/auth/recovery", tags=["recovery"])

RECOVERY_TOKEN_TTL = timedelta(minutes=15)
_RECOVERY_TOKEN_NS = "recovery_token"


class RecoverySetupBody(BaseModel):
    recovery_passphrase: str = Field(min_length=RECOVERY_KEY_MIN_LEN, max_length=RECOVERY_KEY_MAX_LEN)


class RecoveryVerifyBody(BaseModel):
    email: EmailStr
    recovery_passphrase: str = Field(min_length=RECOVERY_KEY_MIN_LEN, max_length=RECOVERY_KEY_MAX_LEN)
    captcha_token: str | None = Field(default=None, max_length=4096)


class RecoveryResetBody(BaseModel):
    recovery_token: str = Field(min_length=16)
    new_password: str = Field(min_length=8, max_length=128)


async def _issue_recovery_token(user_id: str) -> str:
    return await issue_token(
        _RECOVERY_TOKEN_NS,
        {"user_id": user_id},
        int(RECOVERY_TOKEN_TTL.total_seconds()),
    )


async def _consume_recovery_token(token: str) -> str | None:
    record = await consume_token(_RECOVERY_TOKEN_NS, token)
    if not record:
        return None
    return str(record.get("user_id", "")) or None


@router.get("/status")
async def recovery_status(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    doc = await db.recovery_keys.find_one({"user_id": user_id})
    return {"configured": bool(doc), "updated_at": (doc or {}).get("updated_at")}


@router.post("/setup")
async def setup_recovery(
    body: RecoverySetupBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)
    recovery_hash = hash_recovery_passphrase(body.recovery_passphrase)
    await db.recovery_keys.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "recovery_hash": recovery_hash,
                "hash_algo": "argon2id",
                "updated_at": now,
            },
            "$setOnInsert": {"_id": f"rk_{user_id}", "created_at": now},
        },
        upsert=True,
    )
    return {"ok": True, "configured": True}


@router.post("/verify")
async def verify_recovery(
    body: RecoveryVerifyBody,
    request: Request,
    _client: str = Depends(get_client_header),
) -> dict:
    client_ip = request.client.host if request.client else None
    captcha_ok, captcha_detail = await verify_captcha(body.captcha_token, client_ip)
    if not captcha_ok:
        raise HTTPException(status_code=400, detail=captcha_detail)

    db = get_database()
    user = await db.users.find_one({"email": body.email.lower()})
    stored = await db.recovery_keys.find_one({"user_id": user["_id"]}) if user else None
    if not user or not stored:
        raise HTTPException(status_code=403, detail="recovery_invalid")

    if not verify_recovery_passphrase(body.recovery_passphrase, stored["recovery_hash"]):
        raise HTTPException(status_code=403, detail="recovery_invalid")

    if needs_rehash(stored["recovery_hash"]):
        new_hash = hash_recovery_passphrase(body.recovery_passphrase)
        await db.recovery_keys.update_one(
            {"user_id": user["_id"]},
            {"$set": {"recovery_hash": new_hash, "hash_algo": "argon2id"}},
        )

    token = await _issue_recovery_token(user["_id"])
    return {"ok": True, "recovery_token": token, "expires_in_seconds": int(RECOVERY_TOKEN_TTL.total_seconds())}


@router.post("/reset-password")
async def reset_password_with_recovery(
    body: RecoveryResetBody,
    response: Response,
    _client: str = Depends(get_client_header),
) -> dict:
    user_id = await _consume_recovery_token(body.recovery_token)
    if not user_id:
        raise HTTPException(status_code=403, detail="recovery_token_invalid")

    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    ws_token = await issue_user_session(user_id, response)
    return {
        "ok": True,
        "user": {"id": user_id, "display_name": user.get("display_name", "")},
        "ws_token": ws_token,
    }