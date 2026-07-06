"""OAuth CSRF state — store and validate on Google callback (Phase 1)."""

from __future__ import annotations

import time
from typing import Dict

from config import get_settings
from db import get_redis

_STATE_TTL_SEC = 600
_REDIS_PREFIX = "ssc:oauth_state:"
_memory_states: Dict[str, float] = {}


def _purge_memory() -> None:
    now = time.time()
    expired = [k for k, exp in _memory_states.items() if exp < now]
    for key in expired:
        _memory_states.pop(key, None)


async def store_oauth_state(state: str) -> None:
    if not state or not state.strip():
        raise ValueError("oauth_state_empty")
    token = state.strip()
    redis = await get_redis()
    if redis is not None:
        try:
            await redis.setex(f"{_REDIS_PREFIX}{token}", _STATE_TTL_SEC, "1")
            return
        except Exception:
            if get_settings().is_production:
                raise
    _purge_memory()
    _memory_states[token] = time.time() + _STATE_TTL_SEC


async def consume_oauth_state(state: str | None) -> bool:
    if not state or not state.strip():
        return False
    token = state.strip()
    redis = await get_redis()
    if redis is not None:
        try:
            key = f"{_REDIS_PREFIX}{token}"
            deleted = await redis.delete(key)
            return deleted > 0
        except Exception:
            if get_settings().is_production:
                raise
    _purge_memory()
    expires = _memory_states.pop(token, None)
    if expires is None:
        return False
    return time.time() <= expires


def clear_oauth_states_for_tests() -> None:
    _memory_states.clear()