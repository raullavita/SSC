"""One-time OAuth codes for frontend session exchange (cross-origin safe)."""

from __future__ import annotations

import secrets
import time
from typing import Dict, Optional, Tuple

_codes: Dict[str, Tuple[str, float]] = {}
_TTL_SECONDS = 120


def issue_oauth_code(user_id: str) -> str:
    code = secrets.token_urlsafe(32)
    _codes[code] = (user_id, time.time() + _TTL_SECONDS)
    _purge_expired()
    return code


def consume_oauth_code(code: str) -> Optional[str]:
    if not code or not code.strip():
        return None
    entry = _codes.pop(code.strip(), None)
    if not entry:
        return None
    user_id, expires = entry
    if time.time() > expires:
        return None
    return user_id


def _purge_expired() -> None:
    now = time.time()
    expired = [k for k, (_, exp) in _codes.items() if exp < now]
    for k in expired:
        _codes.pop(k, None)