"""Dependency health probes for monitoring and load balancers."""
from typing import Any, Dict

from core.config import ENV
from core.database import db
from core.ws_pubsub import ws_fanout_enabled
from security import get_rate_limit_backend, ping_redis


async def check_mongo() -> Dict[str, Any]:
    try:
        await db.command("ping")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": type(e).__name__}


async def check_redis() -> Dict[str, Any]:
    backend = get_rate_limit_backend()
    if backend == "memory":
        if ENV == "production":
            return {
                "status": "error",
                "detail": "REDIS_URL required in production for revocation and rate limits",
            }
        return {"status": "disabled", "detail": "REDIS_URL not set — per-worker in-memory limits"}
    result = ping_redis()
    if result:
        return {"status": "ok"}
    return {"status": "error", "detail": "Redis unreachable"}


async def full_health() -> Dict[str, Any]:
    mongo = await check_mongo()
    redis = await check_redis()
    if mongo["status"] == "error":
        overall = "error"
    elif ENV == "production" and redis["status"] != "ok":
        overall = "error"
    elif redis["status"] == "error":
        overall = "degraded"
    else:
        overall = "ok"
    return {
        "status": overall,
        "env": ENV,
        "mongo": mongo,
        "redis": redis,
        "rate_limit_backend": get_rate_limit_backend(),
        "ws_fanout": "redis" if ws_fanout_enabled() else "local_only",
        "version": "0.4-standalone",
    }