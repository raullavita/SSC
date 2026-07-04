"""Engine 3 messaging integration tests (in-memory Mongo, cookie auth)."""

from __future__ import annotations

import base64

import pytest
from httpx import ASGITransport, AsyncClient

from core.session_policy import SESSION_COOKIE_NAME
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}
VALID_B64 = base64.b64encode(b"hello engine 3").decode()


async def _no_redis():
    return None


def _patch_db(monkeypatch, fake_db: FakeDatabase) -> None:
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    monkeypatch.setattr("routers.auth.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.conversations.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.messages.get_database", lambda: fake_db)
    monkeypatch.setattr("deps.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)
    monkeypatch.setattr("push.get_database", lambda: fake_db)


@pytest.fixture
async def messaging_env(monkeypatch):
    fake_db = FakeDatabase()
    _patch_db(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    yield fake_db, transport


async def _register(transport, email: str, name: str) -> tuple[dict, object]:
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        assert response.status_code == 200
        body = response.json()
        assert "token" not in body
        assert SESSION_COOKIE_NAME in response.cookies
        return body, client.cookies


@pytest.mark.asyncio
async def test_register_login_and_me(messaging_env):
    fake_db, transport = messaging_env
    _ = fake_db
    reg, cookies = await _register(transport, "alice@example.com", "Alice")

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        me = await ac.get("/api/auth/me", headers=CLIENT)
        assert me.status_code == 200
        assert me.json()["email"] == "alice@example.com"
        assert me.json()["id"] == reg["user"]["id"]


@pytest.mark.asyncio
async def test_create_conversation_and_send_message(messaging_env):
    fake_db, transport = messaging_env
    alice, alice_cookies = await _register(transport, "alice2@example.com", "Alice")
    bob, bob_cookies = await _register(transport, "bob2@example.com", "Bob")

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as alice_ac:
        conv_resp = await alice_ac.post(
            "/api/conversations",
            json={"participant_id": bob["user"]["id"]},
            headers=CLIENT,
        )
        assert conv_resp.status_code == 200
        conv_id = conv_resp.json()["conversation"]["id"]

        send = await alice_ac.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": VALID_B64},
            headers=CLIENT,
        )
        assert send.status_code == 200
        assert send.json()["message"]["protocol"] == "placeholder"

    async with AsyncClient(transport=transport, base_url="http://test", cookies=bob_cookies) as bob_ac:
        listed = await bob_ac.get(
            f"/api/conversations/{conv_id}/messages",
            headers=CLIENT,
        )
        assert listed.status_code == 200
        assert len(listed.json()["messages"]) == 1
        assert len(fake_db["messages"].docs) == 1