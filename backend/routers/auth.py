"""Authentication routes: register, login, 2FA, Google OAuth."""
import os
import secrets
import uuid
from typing import Optional

import pyotp
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from core.auth import (
    client_ip,
    get_current_user,
    hash_password,
    is_installed_client_request,
    jwt_ttl_seconds,
    verify_password,
    verify_turnstile,
)
from core.session_cookie import clear_session_cookie, resolve_request_session_token, set_session_cookie
from core.session_issue import create_session_token, issue_authenticated_session
from core.token_revocation import revoke_token
from core.ws_tickets import issue_ws_ticket
from core.database import db
from core.account_delete_service import execute_account_delete
from core.models import (
    ChangePasswordIn,
    DeleteAccountIn,
    FinishGoogleSetupIn,
    GoogleOAuthExchangeIn,
    GoogleSessionIn,
    LoginIn,
    RegisterIn,
    ResendVerificationIn,
    TwoFADisableIn,
    TwoFASetupVerifyIn,
    UsernameCheckIn,
    VerifyEmailIn,
)
from core.retention import DEFAULT_RETENTION_HOURS
from core.privacy_settings import DEFAULT_PRIVACY
from core.utils import iso, now_utc, validate_username
from security import rate_limit_check

router = APIRouter()


@router.post("/register")
async def register(body: RegisterIn, request: Request, response: Response):
    ip = client_ip(request)
    if not rate_limit_check(f"register:{ip}", max_hits=5, window_sec=3600):
        raise HTTPException(429, "Too many registrations from this IP — try again later")
    from core.config import TURNSTILE_SECRET
    if TURNSTILE_SECRET and not verify_turnstile(
        body.captcha_token or "", ip, skip=is_installed_client_request(request),
    ):
        raise HTTPException(400, "Captcha verification failed")
    err = validate_username(body.username)
    if err:
        raise HTTPException(400, err)
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(409, "Email already registered")
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(409, "Username already taken")
    user_id = f"u_{uuid.uuid4().hex[:14]}"
    from core.email_verification_policy import (
        build_verification_url,
        email_verification_required,
        is_email_verified,
    )
    from core.email_verification_tokens import make_email_verification_token
    from core.email_sender import EmailSendError, send_verification_email

    needs_verify = email_verification_required()
    doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "username": body.username,
        "password_hash": hash_password(body.password),
        "language": body.language or "en",
        "retention_hours": DEFAULT_RETENTION_HOURS,
        "privacy": dict(DEFAULT_PRIVACY),
        "public_key": body.public_key,
        "encrypted_private_key": body.encrypted_private_key,
        "pk_salt": body.pk_salt,
        "avatar": None,
        "auth_provider": "password",
        "email_verified": not needs_verify,
        "totp_enabled": False,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)

    if needs_verify:
        token = make_email_verification_token(user_id, doc["email"])
        verify_url = build_verification_url(token)
        try:
            dev_url = await send_verification_email(
                to_email=doc["email"],
                username=body.username,
                verify_url=verify_url,
            )
        except EmailSendError:
            await db.users.delete_one({"user_id": user_id})
            raise HTTPException(503, "Could not send verification email — try again later")
        out = {
            "verification_required": True,
            "email": doc["email"],
            "message": "Check your email for an activation link",
        }
        if dev_url:
            out["dev_verification_url"] = dev_url
        return out

    token = await issue_authenticated_session(response, request, user_id)
    user = {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "totp_secret")}
    user["email_verified"] = is_email_verified(doc)
    return {"token": token, "user": user}


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    ip = client_ip(request)
    if not rate_limit_check(f"login:{ip}", max_hits=10, window_sec=300):
        raise HTTPException(429, "Too many login attempts — try again in 5 minutes")
    from core.config import TURNSTILE_SECRET
    if TURNSTILE_SECRET and not verify_turnstile(
        body.captcha_token or "", ip, skip=is_installed_client_request(request),
    ):
        raise HTTPException(400, "Captcha verification failed")
    ident = body.email.strip()
    if "@" in ident:
        doc = await db.users.find_one({"email": ident.lower()})
    else:
        doc = await db.users.find_one({"username": ident})
    if doc and doc.get("is_deleted"):
        raise HTTPException(
            410,
            "This account was permanently deleted (panic wipe). Register again with the same email to create a new account.",
        )
    if doc and doc.get("auth_provider") == "google" and not doc.get("password_hash"):
        raise HTTPException(
            401,
            "This account uses Google sign-in. Use Continue with Google.",
            headers={"X-Auth-Provider": "google"},
        )
    if not doc or not doc.get("password_hash") or not verify_password(body.password, doc["password_hash"]):
        if not rate_limit_check(f"login_fail:{ident.lower()}", max_hits=5, window_sec=300):
            raise HTTPException(429, "Too many failed login attempts — try again in 5 minutes")
        raise HTTPException(401, "Invalid credentials")
    from core.email_verification_policy import is_email_verified
    if not is_email_verified(doc):
        raise HTTPException(
            403,
            "Email not verified. Check your inbox for the activation link.",
            headers={"X-Email-Verification-Required": "1"},
        )
    if doc.get("totp_enabled"):
        if not body.totp_code:
            raise HTTPException(401, "2FA code required", headers={"X-Requires-2FA": "1"})
        code_ok = False
        if body.totp_code.isdigit() and pyotp.TOTP(doc["totp_secret"]).verify(body.totp_code, valid_window=1):
            code_ok = True
        elif doc.get("totp_backup_hashes"):
            for h in list(doc.get("totp_backup_hashes", [])):
                if verify_password(body.totp_code, h):
                    await db.users.update_one({"user_id": doc["user_id"]}, {"$pull": {"totp_backup_hashes": h}})
                    code_ok = True
                    break
        if not code_ok:
            raise HTTPException(401, "Invalid 2FA code")
    token = await issue_authenticated_session(response, request, doc["user_id"])
    user = {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "totp_secret")}
    return {"token": token, "user": user}


@router.post("/ws-ticket")
async def ws_ticket(current=Depends(get_current_user)):
    """One-time ticket for WebSocket connect (avoids long-lived JWT in URL)."""
    ticket = issue_ws_ticket(current["user_id"])
    return {"ticket": ticket, "expires_in": 60}


@router.get("/me")
async def me(current=Depends(get_current_user)):
    return current


@router.post("/logout")
async def logout(
    response: Response,
    current=Depends(get_current_user),
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    token = resolve_request_session_token(authorization, session_token)
    if token:
        revoke_token(token, jwt_ttl_seconds(token))
        await db.user_sessions.delete_one({"session_token": token})
    clear_session_cookie(response)
    return {"ok": True}


@router.post("/verify-email")
async def verify_email(body: VerifyEmailIn):
    from core.email_verification_tokens import decode_email_verification_token

    payload = decode_email_verification_token(body.token.strip())
    if not payload:
        raise HTTPException(400, "Invalid or expired verification link")
    user_id = payload["sub"]
    email = payload["email"]
    doc = await db.users.find_one({"user_id": user_id, "email": email}, {"_id": 0})
    if not doc:
        raise HTTPException(400, "Invalid or expired verification link")
    if doc.get("auth_provider") != "password":
        raise HTTPException(400, "This account does not require email verification")
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"email_verified": True, "email_verified_at": iso(now_utc())}},
    )
    return {"ok": True, "email": email}


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationIn, request: Request):
    from core.email_verification_policy import (
        RESEND_COOLDOWN_SECONDS,
        build_verification_url,
        email_verification_required,
    )
    from core.email_verification_tokens import make_email_verification_token
    from core.email_sender import EmailSendError, send_verification_email

    if not email_verification_required():
        raise HTTPException(400, "Email verification is not required")
    ip = client_ip(request)
    email = body.email.lower()
    if not rate_limit_check(f"resend_verify:{ip}", max_hits=5, window_sec=3600):
        raise HTTPException(429, "Too many resend attempts — try again later")
    if not rate_limit_check(f"resend_verify:{email}", max_hits=1, window_sec=RESEND_COOLDOWN_SECONDS):
        raise HTTPException(429, "Please wait before requesting another email")

    doc = await db.users.find_one({"email": email})
    if not doc or doc.get("auth_provider") != "password" or doc.get("email_verified"):
        return {"ok": True, "message": "If that account exists and is unverified, a new email was sent"}

    token = make_email_verification_token(doc["user_id"], email)
    verify_url = build_verification_url(token)
    try:
        dev_url = await send_verification_email(
            to_email=email,
            username=doc.get("username") or "user",
            verify_url=verify_url,
        )
    except EmailSendError:
        raise HTTPException(503, "Could not send verification email — try again later")
    out = {"ok": True, "message": "Verification email sent"}
    if dev_url:
        out["dev_verification_url"] = dev_url
    return out


@router.post("/check-username")
async def check_username(body: UsernameCheckIn):
    err = validate_username(body.username)
    if err:
        return {"available": False, "reason": err}
    exists = await db.users.find_one({"username": body.username})
    if exists:
        return {"available": False, "reason": "Username already taken"}
    return {"available": True}


async def _google_find_or_create(claims: dict) -> tuple[dict, bool]:
    """Return (user_doc sans secrets, needs_setup)."""
    email = (claims.get("email") or "").lower()
    google_sub = claims.get("sub") or ""
    if not email or not google_sub:
        raise HTTPException(400, "Google account missing email")

    doc = await db.users.find_one({"google_sub": google_sub})
    if not doc:
        doc = await db.users.find_one({"email": email})
        if doc and doc.get("auth_provider") == "password" and not doc.get("google_sub"):
            raise HTTPException(
                409,
                "This email already has a password account. Sign in with email and password.",
            )

    if not doc:
        user_id = f"u_{uuid.uuid4().hex[:14]}"
        doc = {
            "user_id": user_id,
            "email": email,
            "username": None,
            "password_hash": None,
            "language": "en",
            "retention_hours": DEFAULT_RETENTION_HOURS,
            "privacy": dict(DEFAULT_PRIVACY),
            "public_key": None,
            "encrypted_private_key": None,
            "pk_salt": None,
            "avatar": claims.get("picture"),
            "auth_provider": "google",
            "google_sub": google_sub,
            "email_verified": True,
            "totp_enabled": False,
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(doc)

    needs_setup = not doc.get("username") or not doc.get("public_key")
    user = {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "totp_secret")}
    return user, needs_setup


@router.get("/google/config")
async def google_config():
    from core.google_auth import is_configured, public_client_id
    cid = public_client_id()
    return {"enabled": is_configured(), "client_id": cid, "id_token_ready": bool(cid)}


@router.post("/google/exchange")
async def google_oauth_exchange(body: GoogleOAuthExchangeIn):
    """Redeem one-time OAuth code from installed-app redirect (no JWT in URL)."""
    from core.oauth_completion import exchange_oauth_completion_code

    token = exchange_oauth_completion_code(body.code.strip())
    if not token:
        raise HTTPException(400, "Invalid or expired OAuth code")
    return {"token": token}


@router.get("/google/start")
async def google_start(platform: str = "native"):
    from core.google_auth import INSTALLED_PLATFORMS, authorization_url, is_configured
    if not is_configured():
        raise HTTPException(501, "Google login not configured on server")
    if platform not in INSTALLED_PLATFORMS:
        raise HTTPException(400, "Google OAuth requires platform=native or platform=desktop")
    return RedirectResponse(authorization_url(platform))


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str = "",
    state: str = "",
    error: str = "",
):
    from core.google_auth import (
        exchange_code,
        frontend_redirect,
        is_configured,
        parse_state,
        verify_id_token,
    )
    if error:
        raise HTTPException(400, f"Google sign-in cancelled: {error}")
    if not code:
        raise HTTPException(400, "Missing authorization code")
    if not is_configured():
        raise HTTPException(501, "Google login not configured")
    try:
        tokens = exchange_code(code)
        claims = verify_id_token(tokens["id_token"])
    except Exception as e:
        raise HTTPException(401, f"Google sign-in failed: {e}")
    user, needs_setup = await _google_find_or_create(claims)
    platform = parse_state(state)
    token = await create_session_token(user["user_id"])
    redirect = RedirectResponse(frontend_redirect(platform, token, needs_setup))
    set_session_cookie(redirect, token, request)
    return redirect


@router.post("/google/session")
async def google_session(body: GoogleSessionIn, request: Request, response: Response):
    from core.google_auth import public_client_id, verify_id_token

    if not public_client_id():
        raise HTTPException(501, "Google login not configured. Set GOOGLE_CLIENT_ID on server.")
    if not body.id_token:
        raise HTTPException(400, "id_token required")

    ip = client_ip(request)
    if not rate_limit_check(f"google:{ip}", max_hits=20, window_sec=300):
        raise HTTPException(429, "Too many Google sign-in attempts")

    try:
        claims = verify_id_token(body.id_token)
    except Exception as e:
        raise HTTPException(401, f"Invalid Google token: {e}")

    user, needs_setup = await _google_find_or_create(claims)
    token = await issue_authenticated_session(response, request, user["user_id"])
    return {"token": token, "user": user, "needs_username": needs_setup}


@router.post("/google/finish-setup")
async def google_finish_setup(body: FinishGoogleSetupIn, current=Depends(get_current_user)):
    err = validate_username(body.username)
    if err:
        raise HTTPException(400, err)
    if await db.users.find_one({"username": body.username, "user_id": {"$ne": current["user_id"]}}):
        raise HTTPException(409, "Username already taken")
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {
            "username": body.username,
            "public_key": body.public_key,
            "encrypted_private_key": body.encrypted_private_key,
            "pk_salt": body.pk_salt,
            "language": body.language or "en",
        }},
    )
    user = await db.users.find_one(
        {"user_id": current["user_id"]},
        {"_id": 0, "password_hash": 0, "totp_secret": 0, "totp_pending_secret": 0},
    )
    return user


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"change_pw:{current['user_id']}", max_hits=5, window_sec=3600):
        raise HTTPException(429, "Too many password change attempts — try again later")
    doc = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    if doc.get("auth_provider") == "google" and not doc.get("password_hash"):
        raise HTTPException(400, "This account uses Google sign-in — password cannot be changed here")
    if not doc.get("password_hash") or not verify_password(body.current_password, doc["password_hash"]):
        raise HTTPException(401, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(400, "New password must be different from the current password")
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {
            "password_hash": hash_password(body.new_password),
            "encrypted_private_key": body.encrypted_private_key,
            "pk_salt": body.pk_salt,
        }},
    )
    return {"ok": True}


@router.post("/delete-account")
async def delete_account(
    body: DeleteAccountIn,
    request: Request,
    response: Response,
    current=Depends(get_current_user),
):
    if not rate_limit_check(f"delete_acct:{current['user_id']}", max_hits=3, window_sec=3600):
        raise HTTPException(429, "Too many delete attempts — try again later")
    doc = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "User not found")
    if (body.username_confirmation or "").strip() != doc.get("username"):
        raise HTTPException(400, "Username confirmation does not match")
    if doc.get("totp_enabled"):
        if not body.totp_code:
            raise HTTPException(401, "2FA code required", headers={"X-Requires-2FA": "1"})
        code_ok = False
        if body.totp_code.isdigit() and pyotp.TOTP(doc["totp_secret"]).verify(body.totp_code, valid_window=1):
            code_ok = True
        elif doc.get("totp_backup_hashes"):
            for h in list(doc.get("totp_backup_hashes", [])):
                if verify_password(body.totp_code, h):
                    code_ok = True
                    break
        if not code_ok:
            raise HTTPException(401, "Invalid 2FA code")
    if doc.get("password_hash"):
        if not body.password or not verify_password(body.password, doc["password_hash"]):
            raise HTTPException(401, "Password required to delete this account")
    session_token = resolve_request_session_token(request)
    result = await execute_account_delete(current["user_id"], session_token=session_token)
    clear_session_cookie(response)
    return result


@router.post("/2fa/setup")
async def twofa_setup(current=Depends(get_current_user)):
    secret = pyotp.random_base32()
    backups = [secrets.token_hex(4) for _ in range(10)]
    backup_hashes = [hash_password(b) for b in backups]
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"totp_pending_secret": secret, "totp_pending_backups": backup_hashes}},
    )
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current["email"], issuer_name="SSC")
    return {"secret": secret, "otpauth_url": uri, "backup_codes": backups}


@router.post("/2fa/verify")
async def twofa_verify(body: TwoFASetupVerifyIn, current=Depends(get_current_user)):
    doc = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    secret = doc.get("totp_pending_secret")
    if not secret:
        raise HTTPException(400, "Start setup first via /auth/2fa/setup")
    if not body.code.isdigit() or not pyotp.TOTP(secret).verify(body.code, valid_window=1):
        raise HTTPException(400, "Invalid code")
    pending_backups = doc.get("totp_pending_backups", [])
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"totp_enabled": True, "totp_secret": secret, "totp_backup_hashes": pending_backups},
         "$unset": {"totp_pending_secret": "", "totp_pending_backups": ""}},
    )
    return {"ok": True, "totp_enabled": True}


@router.post("/2fa/disable")
async def twofa_disable(body: TwoFADisableIn, current=Depends(get_current_user)):
    doc = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    if not doc.get("totp_enabled"):
        return {"ok": True, "totp_enabled": False}
    if not doc.get("password_hash") or not body.password or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(401, "Password required to disable 2FA")
    if not body.code.isdigit() or not pyotp.TOTP(doc["totp_secret"]).verify(body.code, valid_window=1):
        raise HTTPException(401, "Invalid code")
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"totp_enabled": False}, "$unset": {"totp_secret": "", "totp_pending_secret": "", "totp_backup_hashes": ""}},
    )
    return {"ok": True, "totp_enabled": False}


@router.post("/2fa/backups")
async def regenerate_backups(current=Depends(get_current_user)):
    if not current.get("totp_enabled"):
        raise HTTPException(400, "2FA not enabled")
    backups = [secrets.token_hex(4) for _ in range(10)]
    hashes = [hash_password(b) for b in backups]
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"totp_backup_hashes": hashes}},
    )
    return {"backup_codes": backups}