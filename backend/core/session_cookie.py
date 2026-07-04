"""httpOnly session cookie helpers — Engine 5."""

from __future__ import annotations

from fastapi import Response

from config import get_settings
from core.session_policy import SESSION_COOKIE_NAME
from core.session_ttl import jwt_expiry_delta


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    max_age = int(jwt_expiry_delta().total_seconds())
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=max_age,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def read_session_cookie(request) -> str | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token and token.strip():
        return token.strip()
    return None