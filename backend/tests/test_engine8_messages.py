"""signal_v1 message relay tests — Engine 8."""

from __future__ import annotations

import base64

import pytest
from httpx import ASGITransport, AsyncClient

from core.signal_policy import SIGNAL_PROTOCOL_V1
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
        "routers.conversations",
        "routers.friend_requests",
        "routers.messages",
        "deps",
        "push",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


async def _register(transport, email, name):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        assert reg.status_code == 200
        return reg.json(), client.cookies


@pytest.mark.asyncio
async def test_send_signal_v1_message(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    alice, alice_cookies = await _register(transport, "sig@example.com", "Sig")
    bob, bob_cookies = await _register(transport, "sig2@example.com", "Sig2")
    peer_id = bob["user"]["id"]

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        fr = await ac.post(
            "/api/friend_requests",
            json={"to_user_id": peer_id},
            headers=CLIENT,
        )
        fr_id = fr.json()["request"]["id"]

    async with AsyncClient(transport=transport, base_url="http://test", cookies=bob_cookies) as bob_ac:
        await bob_ac.post(f"/api/friend_requests/{fr_id}/accept", headers=CLIENT)

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        conv = await ac.post(
            "/api/conversations",
            json={"participant_id": peer_id},
            headers=CLIENT,
        )
        assert conv.status_code == 200
        conv_id = conv.json()["conversation"]["id"]

        ciphertext = base64.b64encode(b"x" * 32).decode()
        send = await ac.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": ciphertext, "protocol": SIGNAL_PROTOCOL_V1},
            headers=CLIENT,
        )
        assert send.status_code == 200
        assert send.json()["message"]["protocol"] == SIGNAL_PROTOCOL_V1
        assert len(fake_db["messages"].docs) == 1