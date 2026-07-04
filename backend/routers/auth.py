"""Authentication routes — httpOnly session cookies + Google OAuth."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from core.auth_tokens import decode_access_token
from core.google_oauth import (
    FRONTEND_URL,
    build_google_auth_url,
    exchange_code_for_profile,
    google_oauth_configured,
    verify_id_token,
)
from core.ids import new_user_id
from core.last_seen import default_privacy_settings
from core.oauth_exchange import consume_oauth_code, issue_oauth_code
from core.passwords import hash_password, verify_password
from core.session_cookie import clear_session_cookie, read_session_cookie
from core.session_issue import issue_user_session
from core.token_revocation import revoke_session
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=64)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleExchangeBody(BaseModel):
    oauth_code: str = Field(min_length=8)


class GoogleIdTokenBody(BaseModel):
    id_token: str = Field(min_length=20)


def _user_payload(user: dict) -> dict:
    """Metadata-minimized own-profile payload — never expose email."""
    return {
        "id": user["_id"],
        "display_name": user.get("display_name", ""),
    }


async def _issue_auth_response(user: dict, response: Response) -> dict:
    token = await issue_user_session(user["_id"], response)
    return {"user": _user_payload(user), "ws_token": token}


async def _find_or_create_google_user(profile: dict) -> dict:
    db = get_database()
    google_id = profile.get("google_id")
    email = (profile.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="google_email_required")

    user = None
    if google_id:
        user = await db.users.find_one({"google_id": google_id})
    if not user:
        user = await db.users.find_one({"email": email})

    if user:
        updates = {}
        if google_id and not user.get("google_id"):
            updates["google_id"] = google_id
        if profile.get("name") and not user.get("display_name"):
            updates["display_name"] = profile["name"]
        if updates:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            user.update(updates)
        return user

    user_id = new_user_id()
    doc = {
        "_id": user_id,
        "email": email,
        "display_name": (profile.get("name") or email.split("@")[0]).strip()[:64],
        "google_id": google_id,
        "privacy_settings": default_privacy_settings(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    return doc


@router.post("/register")
async def register(
    body: RegisterBody,
    response: Response,
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="email_already_registered")

    user_id = new_user_id()
    doc = {
        "_id": user_id,
        "email": body.email.lower(),
        "display_name": body.display_name.strip(),
        "password_hash": hash_password(body.password),
        "privacy_settings": default_privacy_settings(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    return await _issue_auth_response(doc, response)


@router.post("/login")
async def login(
    body: LoginBody,
    response: Response,
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid_credentials")

    return await _issue_auth_response(user, response)


@router.get("/google/start")
async def google_start() -> RedirectResponse:
    if not google_oauth_configured():
        raise HTTPException(status_code=503, detail="google_oauth_not_configured")
    state = secrets.token_urlsafe(16)
    return RedirectResponse(build_google_auth_url(state), status_code=302)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(..., min_length=4),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/auth/google?error={error}")
    if not google_oauth_configured():
        raise HTTPException(status_code=503, detail="google_oauth_not_configured")
    try:
        profile = await exchange_code_for_profile(code)
        user = await _find_or_create_google_user(profile)
        oauth_code = issue_oauth_code(user["_id"])
        return RedirectResponse(f"{FRONTEND_URL}/auth/google?oauth_code={oauth_code}")
    except ValueError:
        return RedirectResponse(f"{FRONTEND_URL}/auth/google?error=oauth_failed")


@router.post("/google/exchange")
async def google_exchange(
    body: GoogleExchangeBody,
    response: Response,
    _client: str = Depends(get_client_header),
) -> dict:
    user_id = consume_oauth_code(body.oauth_code)
    if not user_id:
        raise HTTPException(status_code=400, detail="invalid_oauth_code")
    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    return await _issue_auth_response(user, response)


@router.post("/google/idtoken")
async def google_idtoken(
    body: GoogleIdTokenBody,
    response: Response,
    _client: str = Depends(get_client_header),
) -> dict:
    if not google_oauth_configured():
        raise HTTPException(status_code=503, detail="google_oauth_not_configured")
    try:
        profile = await verify_id_token(body.id_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="invalid_google_token") from None
    user = await _find_or_create_google_user(profile)
    return await _issue_auth_response(user, response)


@router.get("/me")
async def me(user_id: str = Depends(get_current_user_id)) -> dict:
    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    return _user_payload(user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    token = read_session_cookie(request)
    if token:
        payload = decode_access_token(token)
        jti = payload.get("jti") if payload else None
        if jti:
            await revoke_session(jti)
    clear_session_cookie(response)
    return {"ok": True, "user_id": user_id}