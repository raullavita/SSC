"""Distributed rate limiting — Redis with in-memory fallback (Phase 1)."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field

from config import get_settings
from db import get_redis


@dataclass
class _MemoryWindow:
    limit: int
    window_sec: int
    buckets: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        hits = self.buckets[key]
        cutoff = now - self.window_sec
        self.buckets[key] = [t for t in hits if t >= cutoff]
        if len(self.buckets[key]) >= self.limit:
            return False
        self.buckets[key].append(now)
        return True

    def clear(self) -> None:
        self.buckets.clear()


class RateLimiter:
    def __init__(self, namespace: str, limit: int, window_sec: int) -> None:
        self.namespace = namespace
        self.limit = limit
        self.window_sec = window_sec
        self._memory = _MemoryWindow(limit, window_sec)

    async def allow(self, key: str) -> bool:
        redis = await get_redis()
        if redis is not None:
            try:
                return await self._allow_redis(redis, key)
            except Exception:
                if get_settings().is_production:
                    raise
                return self._memory.allow(key)
        return self._memory.allow(key)

    async def _allow_redis(self, redis, key: str) -> bool:
        redis_key = f"ssc:rl:{self.namespace}:{key}"
        count = await redis.incr(redis_key)
        if count == 1:
            await redis.expire(redis_key, self.window_sec)
        return int(count) <= self.limit

    def clear(self) -> None:
        self._memory.clear()


async def require_redis_for_production_rate_limits(is_production: bool) -> None:
    if not is_production:
        return
    redis = await get_redis()
    if redis is None:
        raise RuntimeError("production_requires_redis_for_rate_limits")