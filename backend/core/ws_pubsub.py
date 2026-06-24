"""
WebSocket Redis pub-sub fan-out — multi-worker Cloud Run support.

When REDIS_URL is set, `publish_ws_event` broadcasts to all API instances;
each instance delivers only to sockets connected locally. Without Redis,
behavior is single-process only (local delivery).
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from typing import Awaitable, Callable, Optional

CHANNEL = "ssc:ws:fanout"
ONLINE_USERS_KEY = "ssc:ws:online_users"
INSTANCE_ID = uuid.uuid4().hex[:12]

_redis_url = (os.environ.get("REDIS_URL") or "").strip()
_redis_async = None
_listener_task: Optional[asyncio.Task] = None
_pubsub = None


def ws_fanout_enabled() -> bool:
    return bool(_redis_url)


def get_instance_id() -> str:
    return INSTANCE_ID


async def _redis_client():
    global _redis_async
    if not _redis_url:
        return None
    if _redis_async is None:
        from redis import asyncio as aioredis

        _redis_async = aioredis.from_url(_redis_url, decode_responses=True)
        await _redis_async.ping()
    return _redis_async


async def mark_user_online(user_id: str) -> None:
    client = await _redis_client()
    if client:
        await client.sadd(ONLINE_USERS_KEY, user_id)


async def mark_user_offline(user_id: str) -> None:
    client = await _redis_client()
    if client:
        await client.srem(ONLINE_USERS_KEY, user_id)


async def is_user_online_global(user_id: str, *, locally_connected: bool) -> bool:
    if locally_connected:
        return True
    client = await _redis_client()
    if not client:
        return locally_connected
    try:
        return bool(await client.sismember(ONLINE_USERS_KEY, user_id))
    except Exception:
        return locally_connected


async def publish_ws_event(user_id: str, payload: dict) -> bool:
    client = await _redis_client()
    if not client:
        return False
    message = json.dumps(
        {"user_id": user_id, "payload": payload, "origin": INSTANCE_ID},
        separators=(",", ":"),
    )
    await client.publish(CHANNEL, message)
    return True


async def start_ws_pubsub_listener(
    deliver_local: Callable[[str, dict], Awaitable[None]],
) -> None:
    """Subscribe to fan-out channel; deliver to local sockets on peer instances."""
    global _listener_task, _pubsub

    client = await _redis_client()
    if not client:
        return

    _pubsub = client.pubsub()
    await _pubsub.subscribe(CHANNEL)

    async def _listen() -> None:
        while True:
            try:
                message = await _pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if not message or message.get("type") != "message":
                    await asyncio.sleep(0.02)
                    continue
                data = json.loads(message["data"])
                if data.get("origin") == INSTANCE_ID:
                    continue
                await deliver_local(data["user_id"], data["payload"])
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(0.25)

    _listener_task = asyncio.create_task(_listen())


async def stop_ws_pubsub_listener() -> None:
    global _listener_task, _pubsub, _redis_async

    if _listener_task:
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
        _listener_task = None

    if _pubsub is not None:
        try:
            await _pubsub.unsubscribe(CHANNEL)
            await _pubsub.aclose()
        except Exception:
            pass
        _pubsub = None

    if _redis_async is not None:
        try:
            await _redis_async.aclose()
        except Exception:
            pass
        _redis_async = None