"""Account recovery key routes — Q.41 vault-path password reset."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from core.auth import (
    client_ip,
    get_current_user,
    hash_password,
    verify_password,
)
from core.database import db
from core.email_verification_policy import is_email_verified
from core.models import (
    RecoveryFetchWrapIn,
    RecoveryRegenerateIn,
    RecoveryResetPasswordIn,
    RecoverySetupIn,
)
from core.recovery_key_policy import validate_recovery_codes
from core.session_issue import issue_authenticated_session
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


def _sanitize_user(doc: dict) -> dict:
    return {
        k: v
        for k, v in doc.items()
        if k
        not in (
            "password_hash",
            "_id",
            "totp_secret",
            "totp_pending_secret",
            "recovery_key_hash",
            "recovery_encrypted_private_key",
            "recovery_pk_salt",
        )
    }


async def _resolve_user(identifier: str) -> Optional[dict]:
    ident = (identifier or "").strip()
    if not ident:
        return None
    if "@" in ident:
        return await db.users.find_one({"email": ident.lower()})
    return await db.users.find_one({"username": ident})


async def _verify_recovery_codes(doc: dict, codes: list) -> None:
    stored = doc.get("recovery_key_hash")
    if not stored:
        raise HTTPException(404, "No recovery key on this account")
    try:
        secret = validate_recovery_codes(codes)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not verify_password(secret, stored):
        raise HTTPException(401, "Invalid recovery codes")


@router.get("/status")
async def recovery_status(current=Depends(get_current_user)):
    return {
        "enabled": bool(current.get("recovery_enabled")),
        "created_at": current.get("recovery_created_at"),
    }


@router.post("/setup")
async def recovery_setup(body: RecoverySetupIn, current=Depends(get_current_user)):
    if not current.get("encrypted_private_key") or not current.get("pk_salt"):
        raise HTTPException(400, "This account has no vault encryption key")
    if current.get("recovery_enabled"):
        raise HTTPException(400, "Recovery key already set — regenerate instead")
    doc = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    if doc.get("password_hash"):
        if not verify_password(body.password, doc["password_hash"]):
            raise HTTPException(401, "Password is incorrect")
    try:
        secret = validate_recovery_codes(body.recovery_codes)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    await db.users.update_one(
        {"user_id": current["user_id"]},
        {
            "$set": {
                "recovery_key_hash": hash_password(secret),
                "recovery_encrypted_private_key": body.recovery_encrypted_private_key,
                "recovery_pk_salt": body.recovery_pk_salt,
                "recovery_created_at": iso(now_utc()),
            }
        },
    )
    return {"ok": True, "recovery_codes": body.recovery_codes}


@router.post("/regenerate")
async def recovery_regenerate(body: RecoveryRegenerateIn, current=Depends(get_current_user)):
    if not current.get("encrypted_private_key") or not current.get("pk_salt"):
        raise HTTPException(400, "This account has no vault encryption key")
    doc = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    if doc.get("password_hash"):
        if not verify_password(body.password, doc["password_hash"]):
            raise HTTPException(401, "Password is incorrect")
    try:
        secret = validate_recovery_codes(body.recovery_codes)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    await db.users.update_one(
        {"user_id": current["user_id"]},
        {
            "$set": {
                "recovery_key_hash": hash_password(secret),
                "recovery_encrypted_private_key": body.recovery_encrypted_private_key,
                "recovery_pk_salt": body.recovery_pk_salt,
                "recovery_created_at": iso(now_utc()),
            }
        },
    )
    return {"ok": True, "recovery_codes": body.recovery_codes}


@router.post("/fetch-wrap")
async def recovery_fetch_wrap(body: RecoveryFetchWrapIn, request: Request):
    ip = client_ip(request)
    if not rate_limit_check(f"recovery_fetch:{ip}", max_hits=10, window_sec=3600):
        raise HTTPException(429, "Too many recovery attempts — try again later")

    doc = await _resolve_user(body.identifier)
    if not doc or doc.get("is_deleted"):
        raise HTTPException(401, "Invalid recovery credentials")
    if not doc.get("recovery_key_hash"):
        raise HTTPException(401, "Invalid recovery credentials")

    try:
        await _verify_recovery_codes(doc, body.recovery_codes)
    except HTTPException as exc:
        if exc.status_code == 401:
            raise HTTPException(401, "Invalid recovery credentials") from exc
        raise

    return {
        "recovery_encrypted_private_key": doc["recovery_encrypted_private_key"],
        "recovery_pk_salt": doc["recovery_pk_salt"],
    }


@router.post("/reset-password")
async def recovery_reset_password(
    body: RecoveryResetPasswordIn,
    request: Request,
    response: Response,
):
    ip = client_ip(request)
    if not rate_limit_check(f"recovery_reset:{ip}", max_hits=5, window_sec=3600):
        raise HTTPException(429, "Too many recovery attempts — try again later")

    doc = await _resolve_user(body.identifier)
    if not doc or doc.get("is_deleted"):
        raise HTTPException(401, "Invalid recovery credentials")
    if not is_email_verified(doc):
        raise HTTPException(
            403,
            "Email not verified. Check your inbox for the activation link.",
            headers={"X-Email-Verification-Required": "1"},
        )
    await _verify_recovery_codes(doc, body.recovery_codes)

    await db.users.update_one(
        {"user_id": doc["user_id"]},
        {
            "$set": {
                "password_hash": hash_password(body.new_password),
                "encrypted_private_key": body.encrypted_private_key,
                "pk_salt": body.pk_salt,
            }
        },
    )

    fresh = await db.users.find_one({"user_id": doc["user_id"]}, {"_id": 0})
    token = await issue_authenticated_session(response, request, doc["user_id"])
    user = _sanitize_user(fresh)
    return {"token": token, "user": user}