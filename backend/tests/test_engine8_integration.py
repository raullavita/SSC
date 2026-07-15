"""Engine 8 in-process integration — cookie auth + signal_v1 relay (replaces live :8000 harness)."""

from __future__ import annotations

import base64

import pytest
from httpx import ASGITransport, AsyncClient

from core.signal_policy import SIGNAL_PROTOCOL_V1
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/8"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.conversations",
        "routers.messages",
        "routers.calls",
        "push",
        "deps",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


async def _register(transport, email: str, name: str):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        assert reg.status_code == 200
        return reg.json(), client.cookies


@pytest.mark.asyncio
async def test_signal_v1_dm_send_persists_message(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    _alice, alice_cookies = await _register(transport, "e8a@example.com", "Alice")
    bob, _ = await _register(transport, "e8b@example.com", "Bob")
    bob_id = bob["user"]["id"]

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        conv = await ac.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            headers=CLIENT,
        )
        assert conv.status_code == 200
        conv_id = conv.json()["conversation"]["id"]

        ciphertext = base64.b64encode(b"x" * 32).decode()
        sent = await ac.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": ciphertext, "protocol": SIGNAL_PROTOCOL_V1},
            headers=CLIENT,
        )
        assert sent.status_code == 200
        assert sent.json()["message"]["protocol"] == SIGNAL_PROTOCOL_V1

    assert len(fake_db["messages"].docs) == 1


@pytest.mark.asyncio
async def test_call_ice_servers_with_session_cookie(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    _reg, cookies = await _register(transport, "ice@example.com", "Ice")

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        ice = await ac.get("/api/calls/ice-servers", headers=CLIENT)
        assert ice.status_code == 200
        assert "ice_servers" in ice.json()