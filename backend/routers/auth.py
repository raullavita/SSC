"""Authentication routes — httpOnly session cookies (Engine 5)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from core.auth_tokens import decode_access_token
from core.ids import new_user_id
from core.last_seen import default_privacy_settings
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


def _user_payload(user: dict) -> dict:
    return {
        "id": user["_id"],
        "email": user["email"],
        "display_name": user.get("display_name", ""),
    }


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
    await issue_user_session(user_id, response)
    return {"user": _user_payload(doc)}


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

    await issue_user_session(user["_id"], response)
    return {"user": _user_payload(user)}


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