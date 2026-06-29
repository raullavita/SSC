"""Short-lived WebAuthn challenges — Q.40."""
from __future__ import annotations

import json
import secrets
import time
from typing import Any, Dict, Optional

from core.webauthn_policy import CHALLENGE_TTL_SEC

_PREFIX = "ssc:webauthn_challenge:"
_memory: dict[str, tuple[float, str]] = {}


def _redis_client():
    import security

    return security._redis


def issue_webauthn_challenge(payload: Dict[str, Any]) -> str:
    challenge_id = secrets.token_urlsafe(24)
    body = json.dumps(payload)
    client = _redis_client()
    if client:
        client.set(f"{_PREFIX}{challenge_id}", body, ex=CHALLENGE_TTL_SEC)
    else:
        _memory[challenge_id] = (time.time() + CHALLENGE_TTL_SEC, body)
    return challenge_id


def consume_webauthn_challenge(challenge_id: str) -> Optional[Dict[str, Any]]:
    if not challenge_id or len(challenge_id) > 128:
        return None
    client = _redis_client()
    if client:
        key = f"{_PREFIX}{challenge_id}"
        raw = client.get(key)
        if not raw:
            return None
        client.delete(key)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    entry = _memory.pop(challenge_id, None)
    if not entry:
        return None
    expires_at, payload = entry
    if time.time() > expires_at:
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return None