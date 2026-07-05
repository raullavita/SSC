"""Health and status endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from config import get_settings
from core.firebase_init import firebase_ready
from core.sfu_policy import SFU_ENABLED, SFU_WS_URL
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
        "push": {
            "provider": "fcm",
            "ready": firebase_ready(),
            "generic_only": True,
        },
        "sfu": {
            "provider": "mediasoup",
            "enabled": SFU_ENABLED,
            "ws_url": SFU_WS_URL if SFU_ENABLED else None,
        },
        "version": "0.2.0",
    }


@router.get("/")
async def root() -> dict:
    return {"name": "SSC - Super Secure Chat", "version": "0.2.0"}