"""Passkey / WebAuthn routes — Q.40 optional login."""
from __future__ import annotations

import base64
import json
from typing import List, Optional

import pyotp
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response

from core.auth import (
    get_current_user,
    verify_password,
    client_ip,
)
from core.database import db
from core.email_verification_policy import is_email_verified
from core.models import (
    PasskeyDeleteIn,
    PasskeyLoginOptionsIn,
    PasskeyLoginVerifyIn,
    PasskeyRegisterOptionsIn,
    PasskeyRegisterVerifyIn,
)
from core.session_issue import issue_authenticated_session
from core.webauthn_challenges import consume_webauthn_challenge, issue_webauthn_challenge
from core.webauthn_policy import (
    is_allowed_origin,
    normalize_request_origin,
    passkeys_enabled,
    user_id_to_bytes,
    webauthn_rp_id,
    webauthn_rp_name,
)
from core.webauthn_store import (
    count_user_passkeys,
    credential_id_bytes,
    credential_public_key_bytes,
    delete_user_passkey,
    get_passkey_by_credential_id,
    list_passkeys_for_user,
    list_user_passkeys,
    save_passkey,
    update_passkey_sign_count,
)
from security import rate_limit_check
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import options_to_json
from webauthn.helpers.structs import (
    AuthenticationCredential,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    RegistrationCredential,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

router = APIRouter()


def _require_passkeys_enabled():
    if not passkeys_enabled():
        raise HTTPException(501, "Passkeys are not enabled on this server")


def _challenge_bytes_from_b64(value: str) -> bytes:
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _sanitize_user(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "totp_secret", "totp_pending_secret")}


async def _resolve_login_user(identifier: Optional[str]) -> Optional[dict]:
    ident = (identifier or "").strip()
    if not ident:
        return None
    if "@" in ident:
        return await db.users.find_one({"email": ident.lower()})
    return await db.users.find_one({"username": ident})


async def _verify_totp_if_enabled(doc: dict, totp_code: Optional[str]) -> None:
    if not doc.get("totp_enabled"):
        return
    if not totp_code:
        raise HTTPException(401, "2FA code required", headers={"X-Requires-2FA": "1"})
    code_ok = False
    if totp_code.isdigit() and pyotp.TOTP(doc["totp_secret"]).verify(totp_code, valid_window=1):
        code_ok = True
    elif doc.get("totp_backup_hashes"):
        for h in list(doc.get("totp_backup_hashes", [])):
            if verify_password(totp_code, h):
                await db.users.update_one({"user_id": doc["user_id"]}, {"$pull": {"totp_backup_hashes": h}})
                code_ok = True
                break
    if not code_ok:
        raise HTTPException(401, "Invalid 2FA code")


@router.get("/config")
async def passkey_config():
    return {
        "enabled": passkeys_enabled(),
        "rp_id": webauthn_rp_id() if passkeys_enabled() else "",
    }


@router.get("/credentials")
async def list_credentials(current=Depends(get_current_user)):
    _require_passkeys_enabled()
    return await list_user_passkeys(current["user_id"])


@router.delete("/credentials")
async def remove_credential(body: PasskeyDeleteIn, current=Depends(get_current_user)):
    _require_passkeys_enabled()
    ok = await delete_user_passkey(current["user_id"], body.credential_id.strip())
    if not ok:
        raise HTTPException(404, "Passkey not found")
    return {"ok": True}


@router.post("/register/options")
async def register_options(
    body: PasskeyRegisterOptionsIn,
    current=Depends(get_current_user),
):
    _require_passkeys_enabled()
    if await count_user_passkeys(current["user_id"]) >= 10:
        raise HTTPException(400, "Passkey limit reached")

    existing = await list_passkeys_for_user(current["user_id"])
    exclude: List[PublicKeyCredentialDescriptor] = []
    for row in existing:
        exclude.append(PublicKeyCredentialDescriptor(
            id=credential_id_bytes(row["credential_id"]),
        ))

    display = (current.get("display_name") or "").strip() or current.get("username") or current["user_id"]
    options = generate_registration_options(
        rp_id=webauthn_rp_id(),
        rp_name=webauthn_rp_name(),
        user_id=user_id_to_bytes(current["user_id"]),
        user_name=current.get("username") or current["user_id"],
        user_display_name=display,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=exclude or None,
    )
    challenge_id = issue_webauthn_challenge({
        "kind": "register",
        "user_id": current["user_id"],
        "challenge": base64.urlsafe_b64encode(options.challenge).decode("ascii").rstrip("="),
        "device_name": (body.device_name or "").strip() or None,
    })
    return {
        "challenge_id": challenge_id,
        "options": json.loads(options_to_json(options)),
    }


@router.post("/register/verify")
async def register_verify(
    body: PasskeyRegisterVerifyIn,
    request: Request,
    origin: Optional[str] = Header(None),
    current=Depends(get_current_user),
):
    _require_passkeys_enabled()
    pending = consume_webauthn_challenge(body.challenge_id)
    if not pending or pending.get("kind") != "register" or pending.get("user_id") != current["user_id"]:
        raise HTTPException(400, "Passkey challenge expired or invalid")

    req_origin = normalize_request_origin(origin) or normalize_request_origin(request.headers.get("origin"))
    if not req_origin or not is_allowed_origin(req_origin):
        raise HTTPException(400, "Invalid WebAuthn origin")

    try:
        credential = RegistrationCredential.parse_raw(json.dumps(body.credential))
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=_challenge_bytes_from_b64(pending["challenge"]),
            expected_rp_id=webauthn_rp_id(),
            expected_origin=req_origin,
            require_user_verification=True,
        )
    except Exception as exc:
        raise HTTPException(400, f"Passkey registration failed: {exc}") from exc

    try:
        saved = await save_passkey(
            user_id=current["user_id"],
            credential_id=verification.credential_id,
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
            device_name=pending.get("device_name"),
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    return {
        "ok": True,
        "credential_id": saved["credential_id"],
        "device_name": saved.get("device_name"),
    }


@router.post("/login/options")
async def login_options(body: PasskeyLoginOptionsIn, request: Request):
    _require_passkeys_enabled()
    ip = client_ip(request)
    if not rate_limit_check(f"passkey_login:{ip}", max_hits=20, window_sec=300):
        raise HTTPException(429, "Too many passkey attempts")

    user_doc = await _resolve_login_user(body.identifier)
    allow: Optional[List[PublicKeyCredentialDescriptor]] = None
    user_id: Optional[str] = None

    if user_doc:
        if user_doc.get("is_deleted"):
            raise HTTPException(410, "Account was permanently deleted")
        rows = await list_passkeys_for_user(user_doc["user_id"])
        if not rows:
            raise HTTPException(404, "No passkeys registered for this account")
        allow = [PublicKeyCredentialDescriptor(id=credential_id_bytes(r["credential_id"])) for r in rows]
        user_id = user_doc["user_id"]

    options = generate_authentication_options(
        rp_id=webauthn_rp_id(),
        allow_credentials=allow,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    challenge_id = issue_webauthn_challenge({
        "kind": "login",
        "user_id": user_id,
        "challenge": base64.urlsafe_b64encode(options.challenge).decode("ascii").rstrip("=")
        if isinstance(options.challenge, bytes)
        else options.challenge,
    })
    return {
        "challenge_id": challenge_id,
        "options": json.loads(options_to_json(options)),
    }


@router.post("/login/verify")
async def login_verify(
    body: PasskeyLoginVerifyIn,
    request: Request,
    response: Response,
    origin: Optional[str] = Header(None),
):
    _require_passkeys_enabled()
    ip = client_ip(request)
    if not rate_limit_check(f"passkey_verify:{ip}", max_hits=20, window_sec=300):
        raise HTTPException(429, "Too many passkey attempts")

    pending = consume_webauthn_challenge(body.challenge_id)
    if not pending or pending.get("kind") != "login":
        raise HTTPException(400, "Passkey challenge expired or invalid")

    req_origin = normalize_request_origin(origin) or normalize_request_origin(request.headers.get("origin"))
    if not req_origin or not is_allowed_origin(req_origin):
        raise HTTPException(400, "Invalid WebAuthn origin")

    try:
        credential = AuthenticationCredential.parse_raw(json.dumps(body.credential))
    except Exception as exc:
        raise HTTPException(400, "Invalid passkey credential") from exc

    cred_id_b64 = base64.urlsafe_b64encode(credential.raw_id).decode("ascii").rstrip("=")
    stored = await get_passkey_by_credential_id(cred_id_b64)
    if not stored:
        raise HTTPException(401, "Unknown passkey")

    if pending.get("user_id") and stored["user_id"] != pending["user_id"]:
        raise HTTPException(401, "Passkey does not match account")

    user_doc = await db.users.find_one({"user_id": stored["user_id"]})
    if not user_doc or user_doc.get("is_deleted"):
        raise HTTPException(410, "Account was permanently deleted")
    if not is_email_verified(user_doc):
        raise HTTPException(
            403,
            "Email not verified. Check your inbox for the activation link.",
            headers={"X-Email-Verification-Required": "1"},
        )

    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=_challenge_bytes_from_b64(pending["challenge"]),
            expected_rp_id=webauthn_rp_id(),
            expected_origin=req_origin,
            credential_public_key=credential_public_key_bytes(stored),
            credential_current_sign_count=stored.get("sign_count", 0),
            require_user_verification=True,
        )
    except Exception as exc:
        raise HTTPException(401, f"Passkey verification failed: {exc}") from exc

    await _verify_totp_if_enabled(user_doc, body.totp_code)
    await update_passkey_sign_count(cred_id_b64, verification.new_sign_count)

    token = await issue_authenticated_session(response, request, user_doc["user_id"])
    user = _sanitize_user(user_doc)
    return {"token": token, "user": user}