"""FastAPI dependencies."""

from __future__ import annotations

from fastapi import Header, HTTPException

from core.auth_tokens import decode_access_token
from core.installed_client_policy import INSTALLED_CLIENT_HEADER, parse_client_header
from db import get_database


async def get_current_user_id(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="bearer_token_required")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="invalid_token")
    user_id = str(payload["sub"])
    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user_id


def get_client_header(
    x_ssc_client: str | None = Header(default=None, alias=INSTALLED_CLIENT_HEADER),
) -> str:
    identity = parse_client_header(x_ssc_client)
    if identity is None:
        raise HTTPException(
            status_code=403,
            detail=(
                "installed_client_required: SSC works only in the "
                "installed Android, iOS, Windows, or Mac app"
            ),
        )
    return identity.raw