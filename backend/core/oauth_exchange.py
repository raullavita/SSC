"""One-time OAuth codes for frontend session exchange (cross-origin safe)."""

from __future__ import annotations

from typing import Optional

from core.short_lived_tokens import consume_token, issue_token

_NAMESPACE = "oauth_code"
_TTL_SECONDS = 120


async def issue_oauth_code(user_id: str) -> str:
    return await issue_token(_NAMESPACE, {"user_id": user_id}, _TTL_SECONDS)


async def consume_oauth_code(code: str) -> Optional[str]:
    record = await consume_token(_NAMESPACE, code)
    if not record:
        return None
    return str(record.get("user_id", "")) or None