"""Health and status endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from config import get_settings
from db import probe_mongo, probe_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """Detailed probe for load balancers / uptime monitors."""
    settings = get_settings()
    mongo = await probe_mongo()
    redis = await probe_redis()
    return {
        "status": "ok" if mongo.get("status") == "ok" else "degraded",
        "env": settings.env,
        "mongo": mongo,
        "redis": redis,
        "rate_limit_backend": "redis" if settings.redis_url else "memory",
        "ws_fanout": "redis" if settings.redis_url else "memory",
        "version": "0.1.0-phase0",
    }


@router.get("/")
async def root() -> dict:
    return {"name": "SSC - Super Secure Chat", "version": "0.1.0-phase0"}