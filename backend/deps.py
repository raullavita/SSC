"""FastAPI dependencies."""

from __future__ import annotations

from fastapi import Header, HTTPException, Request

from core.auth_tokens import decode_access_token
from core.installed_client_policy import INSTALLED_CLIENT_HEADER, parse_client_header
from core.session_cookie import read_session_cookie
from core.session_policy import ALLOW_BEARER_FALLBACK
from core.token_revocation import is_session_revoked
from db import get_database


async def _resolve_token(request: Request, authorization: str | None) -> str:
    cookie_token = read_session_cookie(request)
    if cookie_token:
        return cookie_token
    if ALLOW_BEARER_FALLBACK and authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    raise HTTPException(status_code=401, detail="session_required")


async def get_current_user_id(
    request: Request,
    authorization: str | None = Header(default=None),
) -> str:
    token = await _resolve_token(request, authorization)
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="invalid_token")

    jti = payload.get("jti")
    if jti and await is_session_revoked(jti):
        raise HTTPException(status_code=401, detail="session_revoked")

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