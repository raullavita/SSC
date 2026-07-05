"""User lookup + username discovery — metadata-minimized."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.username_policy import (
    normalize_username,
    public_user_lookup,
    resolve_lookup_target,
    validate_username,
)
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/users", tags=["users"])


class SetUsernameBody(BaseModel):
    username: str = Field(min_length=3, max_length=32)


async def _find_user_for_lookup(db, target: str) -> dict | None:
    kind, value = resolve_lookup_target(target)
    if kind == "username":
        return await db.users.find_one({"username": value})
    return await db.users.find_one({"_id": value}, {"display_name": 1, "username": 1})


@router.get("/by-username/{username}")
async def lookup_by_username(
    username: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    normalized = normalize_username(username)
    if validate_username(normalized):
        raise HTTPException(status_code=400, detail="username_invalid")

    db = get_database()
    doc = await db.users.find_one({"username": normalized})
    if not doc:
        raise HTTPException(status_code=404, detail="user_not_found")
    if doc["_id"] == user_id:
        raise HTTPException(status_code=400, detail="cannot_lookup_self")

    return {"user": public_user_lookup(doc)}


@router.get("/lookup/{target}")
async def lookup_user(
    target: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    kind, value = resolve_lookup_target(target)
    if kind == "id" and value == user_id:
        raise HTTPException(status_code=400, detail="cannot_lookup_self")

    db = get_database()
    doc = await _find_user_for_lookup(db, target)
    if not doc:
        raise HTTPException(status_code=404, detail="user_not_found")
    if doc["_id"] == user_id:
        raise HTTPException(status_code=400, detail="cannot_lookup_self")

    return {"user": public_user_lookup(doc)}


@router.patch("/me/username")
async def set_username(
    body: SetUsernameBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    err = validate_username(body.username)
    if err:
        raise HTTPException(status_code=400, detail=err)

    username = normalize_username(body.username)
    db = get_database()
    existing = await db.users.find_one({"username": username})
    if existing and existing["_id"] != user_id:
        raise HTTPException(status_code=409, detail="username_taken")

    await db.users.update_one({"_id": user_id}, {"$set": {"username": username}})
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    from routers.auth import _user_payload  # noqa: PLC0415

    return {"user": _user_payload(user)}