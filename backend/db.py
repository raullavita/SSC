"""MongoDB and Redis connection helpers with health probes."""

from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import get_settings

_mongo_client: AsyncIOMotorClient | None = None
_redis_client: aioredis.Redis | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _mongo_client
    if _mongo_client is None:
        settings = get_settings()
        timeout_ms = settings.mongo_server_selection_timeout_ms
        _mongo_client = AsyncIOMotorClient(
            settings.mongo_url,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
        )
    return _mongo_client


def get_database() -> AsyncIOMotorDatabase:
    settings = get_settings()
    return get_mongo_client()[settings.mongo_db]


async def get_redis() -> aioredis.Redis | None:
    global _redis_client
    settings = get_settings()
    if not settings.redis_url:
        return None
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def probe_mongo() -> dict[str, Any]:
    try:
        client = get_mongo_client()
        await client.admin.command("ping")
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001 — health probe
        return {"status": "error", "detail": str(exc)}


async def probe_redis() -> dict[str, Any]:
    settings = get_settings()
    if not settings.redis_url:
        return {"status": "skipped", "detail": "REDIS_URL not configured"}
    try:
        client = await get_redis()
        assert client is not None
        await client.ping()
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001 — health probe
        return {"status": "error", "detail": str(exc)}


async def close_connections() -> None:
    global _mongo_client, _redis_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None