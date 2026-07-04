"""Push token registration — Engine 4."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from deps import get_client_header, get_current_user_id
from native_push import register_push_token

router = APIRouter(prefix="/push", tags=["push"])


class RegisterPushBody(BaseModel):
    token: str = Field(min_length=10)
    platform: str = Field(pattern=r"^(android|ios|windows|mac|electron)$")


@router.post("/register")
async def register_push(
    body: RegisterPushBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    return await register_push_token(user_id, body.token, body.platform)