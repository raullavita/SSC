"""WebSocket connection hub with optional Redis pub/sub fanout — Engine 3."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("ssc")

REDIS_WS_CHANNEL = "ssc:ws:fanout"


class WsHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._user_sockets: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._redis_task: asyncio.Task | None = None

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._user_sockets.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        async with self._lock:
            if user_id in self._user_sockets:
                self._user_sockets[user_id].discard(websocket)
                if not self._user_sockets[user_id]:
                    del self._user_sockets[user_id]
            for topic, sockets in list(self._connections.items()):
                sockets.discard(websocket)
                if not sockets:
                    del self._connections[topic]

    async def subscribe(self, websocket: WebSocket, topic: str) -> None:
        async with self._lock:
            self._connections.setdefault(topic, set()).add(websocket)

    async def publish_local(self, topic: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._connections.get(topic, set()))
        if not sockets:
            return
        data = json.dumps({"topic": topic, "payload": payload})
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(data)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        if dead:
            async with self._lock:
                bucket = self._connections.get(topic, set())
                for ws in dead:
                    bucket.discard(ws)

    async def publish(self, topic: str, payload: dict[str, Any]) -> None:
        from db import get_redis  # noqa: PLC0415

        redis = await get_redis()
        if redis is not None:
            try:
                envelope = json.dumps({"topic": topic, "payload": payload})
                await redis.publish(REDIS_WS_CHANNEL, envelope)
            except Exception:  # noqa: BLE001 — fall back when Redis unavailable
                logger.warning("redis publish failed; using local fanout only")
        await self.publish_local(topic, payload)

    async def start_redis_listener(self) -> None:
        from db import get_redis  # noqa: PLC0415

        redis = await get_redis()
        if redis is None:
            return
        if self._redis_task and not self._redis_task.done():
            return

        async def _listen() -> None:
            pubsub = redis.pubsub()
            await pubsub.subscribe(REDIS_WS_CHANNEL)
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    topic = data["topic"]
                    payload = data["payload"]
                    await self.publish_local(topic, payload)
                except Exception:  # noqa: BLE001
                    logger.exception("ws redis fanout decode failed")

        self._redis_task = asyncio.create_task(_listen())


ws_hub = WsHub()