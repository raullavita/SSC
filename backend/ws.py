"""
WebSocket connection manager — local sockets + optional Redis fan-out.
"""
import json
from typing import Dict, List

from fastapi import WebSocket

from core.ws_pubsub import publish_ws_event


class ConnectionManager:
    def __init__(self):
        self.user_sockets: Dict[str, List[WebSocket]] = {}

    def is_locally_connected(self, user_id: str) -> bool:
        return bool(self.user_sockets.get(user_id))

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        first = user_id not in self.user_sockets or not self.user_sockets[user_id]
        self.user_sockets.setdefault(user_id, []).append(ws)
        if first:
            from core.ws_pubsub import mark_user_online

            await mark_user_online(user_id)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.user_sockets:
            self.user_sockets[user_id] = [s for s in self.user_sockets[user_id] if s is not ws]
            if not self.user_sockets[user_id]:
                self.user_sockets.pop(user_id, None)

    async def after_disconnect(self, user_id: str) -> None:
        """Call after disconnect when user has no remaining local sockets."""
        if not self.is_locally_connected(user_id):
            from core.ws_pubsub import mark_user_offline

            await mark_user_offline(user_id)

    async def deliver_local(self, user_id: str, payload: dict):
        for ws in list(self.user_sockets.get(user_id, [])):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                pass

    async def send_to_user(self, user_id: str, payload: dict):
        await self.deliver_local(user_id, payload)
        await publish_ws_event(user_id, payload)

# broadcast_to_conversation lives in core/realtime.py