"""WebSocket topic unsubscribe tests."""

from __future__ import annotations

import pytest

from core.ws_hub import WsHub


class _FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send_text(self, data: str) -> None:
        self.sent.append(data)


@pytest.mark.asyncio
async def test_ws_hub_unsubscribe_stops_local_delivery():
    hub = WsHub()
    ws_a = _FakeWebSocket()
    ws_b = _FakeWebSocket()
    topic = "user:u1"

    await hub.subscribe(ws_a, topic)
    await hub.subscribe(ws_b, topic)
    await hub.unsubscribe(ws_a, topic)

    await hub.publish_local(topic, {"type": "ping"})

    assert ws_a.sent == []
    assert len(ws_b.sent) == 1