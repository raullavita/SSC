"""WebSocket Redis pub-sub fan-out tests."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.ws_pubsub import (
    CHANNEL,
    INSTANCE_ID,
    ONLINE_USERS_KEY,
    is_user_online_global,
    publish_ws_event,
    ws_fanout_enabled,
)
from ws import ConnectionManager


@pytest.mark.asyncio
async def test_send_to_user_delivers_locally_without_redis(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    import core.ws_pubsub as mod

    monkeypatch.setattr(mod, "_redis_url", "")
    monkeypatch.setattr(mod, "_redis_async", None)

    mgr = ConnectionManager()
    ws = AsyncMock()
    ws.send_text = AsyncMock()
    await mgr.connect("u1", ws)
    await mgr.send_to_user("u1", {"type": "ping"})
    ws.send_text.assert_called_once()
    body = json.loads(ws.send_text.call_args[0][0])
    assert body["type"] == "ping"


@pytest.mark.asyncio
async def test_publish_ws_event_returns_false_without_redis(monkeypatch):
    import core.ws_pubsub as mod

    monkeypatch.setattr(mod, "_redis_url", "")
    monkeypatch.setattr(mod, "_redis_async", None)
    assert await publish_ws_event("u1", {"type": "x"}) is False


@pytest.mark.asyncio
async def test_publish_ws_event_publishes_json(monkeypatch):
    import core.ws_pubsub as mod

    fake = AsyncMock()
    fake.publish = AsyncMock(return_value=1)
    monkeypatch.setattr(mod, "_redis_url", "redis://localhost:6379/0")
    monkeypatch.setattr(mod, "_redis_async", fake)

    ok = await publish_ws_event("u9", {"type": "message", "data": {}})
    assert ok is True
    fake.publish.assert_awaited_once()
    channel, raw = fake.publish.await_args.args
    assert channel == CHANNEL
    payload = json.loads(raw)
    assert payload["user_id"] == "u9"
    assert payload["origin"] == INSTANCE_ID
    assert payload["payload"]["type"] == "message"


@pytest.mark.asyncio
async def test_is_user_online_global_local_short_circuit(monkeypatch):
    import core.ws_pubsub as mod

    monkeypatch.setattr(mod, "_redis_url", "redis://localhost:6379/0")
    assert await is_user_online_global("u1", locally_connected=True) is True


@pytest.mark.asyncio
async def test_after_disconnect_marks_offline_when_no_sockets(monkeypatch):
    import core.ws_pubsub as mod

    offline = AsyncMock()
    monkeypatch.setattr(mod, "mark_user_offline", offline)

    mgr = ConnectionManager()
    ws = MagicMock()
    mgr.user_sockets["u1"] = [ws]
    mgr.disconnect("u1", ws)
    await mgr.after_disconnect("u1")
    offline.assert_awaited_once_with("u1")


def test_ws_fanout_enabled_reflects_redis_url(monkeypatch):
    import core.ws_pubsub as mod

    monkeypatch.setattr(mod, "_redis_url", "redis://localhost:6379/0")
    assert mod.ws_fanout_enabled() is True
    monkeypatch.setattr(mod, "_redis_url", "")
    assert mod.ws_fanout_enabled() is False
    assert mod.ONLINE_USERS_KEY == "ssc:ws:online_users"