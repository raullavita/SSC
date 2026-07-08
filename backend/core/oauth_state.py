"""OAuth CSRF state — store and validate on Google callback (Phase 1)."""

from __future__ import annotations

import time
from typing import Dict

from config import get_settings
from db import get_redis

_STATE_TTL_SEC = 600
_REDIS_PREFIX = "ssc:oauth_state:"
_memory_states: Dict[str, tuple[float, str]] = {}


def _purge_memory() -> None:
    now = time.time()
    expired = [k for k, (exp, _mode) in _memory_states.items() if exp < now]
    for key in expired:
        _memory_states.pop(key, None)


def _normalize_oauth_client(client: str | None) -> str:
    return "installed" if (client or "").strip().lower() == "installed" else "web"


async def store_oauth_state(state: str, *, client: str = "web") -> None:
    if not state or not state.strip():
        raise ValueError("oauth_state_empty")
    token = state.strip()
    mode = _normalize_oauth_client(client)
    redis = await get_redis()
    if redis is not None:
        try:
            await redis.setex(f"{_REDIS_PREFIX}{token}", _STATE_TTL_SEC, mode)
            return
        except Exception:
            if get_settings().is_production:
                raise
    _purge_memory()
    _memory_states[token] = (time.time() + _STATE_TTL_SEC, mode)


async def consume_oauth_state(state: str | None) -> str | None:
    if not state or not state.strip():
        return None
    token = state.strip()
    redis = await get_redis()
    if redis is not None:
        try:
            key = f"{_REDIS_PREFIX}{token}"
            mode = await redis.get(key)
            if not mode:
                return None
            await redis.delete(key)
            return _normalize_oauth_client(mode.decode() if isinstance(mode, bytes) else mode)
        except Exception:
            if get_settings().is_production:
                raise
    _purge_memory()
    entry = _memory_states.pop(token, None)
    if entry is None:
        return None
    expires, mode = entry
    if time.time() > expires:
        return None
    return mode


def clear_oauth_states_for_tests() -> None:
    _memory_states.clear()