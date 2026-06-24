"""One-time OAuth completion codes — avoid putting JWTs in redirect URLs."""
from __future__ import annotations

import json
import secrets
import time
from typing import Optional

from security import rate_limit_check

TTL_SEC = 120
_PREFIX = "ssc:oauth_complete:"

_memory: dict[str, tuple[float, str]] = {}


def _redis_client():
    import security

    return security._redis


def issue_oauth_completion_code(session_token: str) -> str:
    if not session_token:
        raise ValueError("session_token required")
    code = secrets.token_urlsafe(32)
    payload = json.dumps({"token": session_token})
    client = _redis_client()
    if client:
        client.set(f"{_PREFIX}{code}", payload, ex=TTL_SEC)
    else:
        _memory[code] = (time.time() + TTL_SEC, payload)
    return code


def exchange_oauth_completion_code(code: str) -> Optional[str]:
    if not code or len(code) > 256:
        return None
    if not rate_limit_check(f"oauth_exchange:{code[:16]}", max_hits=5, window_sec=300):
        return None

    client = _redis_client()
    if client:
        key = f"{_PREFIX}{code}"
        raw = client.get(key)
        if not raw:
            return None
        client.delete(key)
        try:
            return json.loads(raw).get("token")
        except (json.JSONDecodeError, AttributeError):
            return None

    entry = _memory.pop(code, None)
    if not entry:
        return None
    expires_at, payload = entry
    if time.time() > expires_at:
        return None
    try:
        return json.loads(payload).get("token")
    except json.JSONDecodeError:
        return None