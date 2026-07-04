"""Issue sessions on login/register — Engine 5."""

from __future__ import annotations

import secrets

from fastapi import Response

from core.auth_tokens import issue_access_token
from core.session_cookie import set_session_cookie
from core.token_revocation import register_session


async def issue_user_session(user_id: str, response: Response) -> str:
    jti = secrets.token_hex(16)
    token = issue_access_token(user_id, jti=jti)
    await register_session(user_id, token, jti)
    set_session_cookie(response, token)
    return token