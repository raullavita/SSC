"""Sesame decrypt retry request API tests."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.sesame_retry",
        "deps",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


async def _register(transport, email: str, name: str):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        return response.json(), client.cookies


@pytest.mark.asyncio
async def test_retry_request_notifies_sender(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.sesame_retry.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    reg_a, cookies_a = await _register(transport, "alice@example.com", "Alice")
    reg_b, cookies_b = await _register(transport, "bob@example.com", "Bob")
    alice_id = reg_a["user"]["id"]
    bob_id = reg_b["user"]["id"]
    now = datetime.now(timezone.utc)
    await fake_db.conversations.insert_one(
        {
            "_id": "c_retry",
            "type": "direct",
            "participants": [alice_id, bob_id],
            "created_at": now,
            "updated_at": now,
        }
    )
    await fake_db.messages.insert_one(
        {
            "_id": "m_retry",
            "conversation_id": "c_retry",
            "sender_id": alice_id,
            "ciphertext": "Y2lwaGVydGV4dA==",
            "protocol": "signal_v1",
            "created_at": now,
        }
    )

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies_b) as ac:
        resp = await ac.post(
            "/api/messages/retry-request",
            json={
                "message_id": "m_retry",
                "conversation_id": "c_retry",
                "requester_device_id": "1",
            },
            headers=CLIENT,
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert resp.json()["retry_count"] == 1

    publish_mock.assert_awaited()
    args, _kwargs = publish_mock.await_args
    assert args[0] == f"user:{alice_id}"
    assert args[1]["type"] == "decrypt_retry_request"