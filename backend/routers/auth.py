"""Authentication routes — Engine 3."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from core.auth_tokens import issue_access_token
from core.ids import new_user_id
from core.passwords import hash_password, verify_password
from core.retention_policy import default_expires_at
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


@router.post("/register")
async def register(
    body: RegisterBody,
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
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    token = issue_access_token(user_id)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": doc["email"],
            "display_name": doc["display_name"],
        },
    }


@router.post("/login")
async def login(
    body: LoginBody,
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid_credentials")

    token = issue_access_token(user["_id"])
    return {
        "token": token,
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "display_name": user.get("display_name", ""),
        },
    }


@router.get("/me")
async def me(user_id: str = Depends(get_current_user_id)) -> dict:
    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    return {
        "id": user["_id"],
        "email": user["email"],
        "display_name": user.get("display_name", ""),
    }


@router.post("/logout")
async def logout(user_id: str = Depends(get_current_user_id)) -> dict:
    # Engine 5 will revoke sessions server-side; client clears token locally.
    return {"ok": True, "user_id": user_id}