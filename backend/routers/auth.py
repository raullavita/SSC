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
    jwt_ttl_seconds,
    verify_password,
    verify_turnstile,
)
from core.session_cookie import clear_session_cookie, resolve_request_session_token, set_session_cookie
from core.session_issue import create_session_token, issue_authenticated_session
from core.token_revocation import revoke_token
from core.ws_tickets import issue_ws_ticket
from core.database import db
from core.models import (
    FinishGoogleSetupIn,
    GoogleOAuthExchangeIn,
    GoogleSessionIn,
    LoginIn,
    RegisterIn,
    TwoFADisableIn,
    TwoFASetupVerifyIn,
    UsernameCheckIn,
)
from core.utils import iso, now_utc, validate_username
from security import rate_limit_check

router = APIRouter()


@router.post("/register")
async def register(body: RegisterIn, request: Request, response: Response):
    ip = client_ip(request)
    if not rate_limit_check(f"register:{ip}", max_hits=5, window_sec=3600):
        raise HTTPException(429, "Too many registrations from this IP — try again later")
    from core.config import TURNSTILE_SECRET
    if TURNSTILE_SECRET and not verify_turnstile(body.captcha_token or "", ip):
        raise HTTPException(400, "Captcha verification failed")
    err = validate_username(body.username)
    if err:
        raise HTTPException(400, err)
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(409, "Email already registered")
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(409, "Username already taken")
    user_id = f"u_{uuid.uuid4().hex[:14]}"
    doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "username": body.username,
        "password_hash": hash_password(body.password),
        "language": body.language or "en",
        "public_key": body.public_key,
        "encrypted_private_key": body.encrypted_private_key,
        "pk_salt": body.pk_salt,
        "avatar": None,
        "auth_provider": "password",
        "totp_enabled": False,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    token = await issue_authenticated_session(response, request, user_id)
    user = {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "totp_secret")}
    return {"token": token, "user": user}


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    ip = client_ip(request)
    if not rate_limit_check(f"login:{ip}", max_hits=10, window_sec=300):
        raise HTTPException(429, "Too many login attempts — try again in 5 minutes")
    from core.config import TURNSTILE_SECRET
    if TURNSTILE_SECRET and not verify_turnstile(body.captcha_token or "", ip):
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
            "public_key": None,
            "encrypted_private_key": None,
            "pk_salt": None,
            "avatar": claims.get("picture"),
            "auth_provider": "google",
            "google_sub": google_sub,
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