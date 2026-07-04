"""Production startup gates — Engine 5."""

from __future__ import annotations

import logging

from config import Settings
from db import probe_redis

logger = logging.getLogger("ssc")


async def validate_production_redis(settings: Settings) -> None:
    """Production must have working Redis for session validation."""
    if not settings.is_production:
        return
    if not settings.redis_url:
        raise RuntimeError("production_requires_redis: set REDIS_URL")
    probe = await probe_redis()
    if probe.get("status") != "ok":
        raise RuntimeError(f"production_redis_unavailable: {probe.get('detail', probe)}")
    logger.info("Production Redis gate passed")