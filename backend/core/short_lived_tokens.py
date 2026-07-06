"""Redis-backed short-lived tokens with in-memory fallback (Phase 2)."""

from __future__ import annotations

import json
import secrets
import time
from typing import Any

from config import get_settings
from db import get_redis

_REDIS_PREFIX = "ssc:token:"
_memory_buckets: dict[str, dict[str, dict[str, Any]]] = {}


async def issue_token(namespace: str, payload: dict[str, Any], ttl_sec: int) -> str:
    token = secrets.token_urlsafe(32)
    record = {**payload, "_expires": time.time() + ttl_sec}
    redis = await get_redis()
    if redis is not None:
        try:
            await redis.setex(
                f"{_REDIS_PREFIX}{namespace}:{token}",
                ttl_sec,
                json.dumps(record),
            )
            return token
        except Exception:
            if get_settings().is_production:
                raise
    _memory_buckets.setdefault(namespace, {})[token] = record
    return token


async def consume_token(namespace: str, token: str | None) -> dict[str, Any] | None:
    if not token or not token.strip():
        return None
    key = token.strip()
    redis = await get_redis()
    if redis is not None:
        try:
            redis_key = f"{_REDIS_PREFIX}{namespace}:{key}"
            raw = await redis.get(redis_key)
            if raw:
                await redis.delete(redis_key)
                record = json.loads(raw)
                return _valid_record(record)
            return None
        except Exception:
            if get_settings().is_production:
                raise
    record = _memory_buckets.get(namespace, {}).pop(key, None)
    return _valid_record(record) if record else None


def _valid_record(record: dict[str, Any]) -> dict[str, Any] | None:
    expires = record.get("_expires", 0)
    if time.time() > float(expires):
        return None
    out = dict(record)
    out.pop("_expires", None)
    return out


def clear_memory_tokens_for_tests() -> None:
    _memory_buckets.clear()