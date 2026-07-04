"""Engine 3 messaging integration tests (in-memory Mongo)."""

from __future__ import annotations

import base64

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}
VALID_B64 = base64.b64encode(b"hello engine 3").decode()


@pytest.fixture
async def messaging_client(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("routers.auth.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.conversations.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.messages.get_database", lambda: fake_db)
    monkeypatch.setattr("deps.get_database", lambda: fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, fake_db


async def _register(ac: AsyncClient, email: str, name: str) -> dict:
    response = await ac.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "display_name": name},
        headers=CLIENT,
    )
    assert response.status_code == 200
    return response.json()


@pytest.mark.asyncio
async def test_register_login_and_me(messaging_client):
    ac, _ = messaging_client
    reg = await _register(ac, "alice@example.com", "Alice")
    token = reg["token"]

    me = await ac.get("/api/auth/me", headers={**CLIENT, "Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"


@pytest.mark.asyncio
async def test_create_conversation_and_send_message(messaging_client):
    ac, db = messaging_client
    alice = await _register(ac, "alice2@example.com", "Alice")
    bob = await _register(ac, "bob2@example.com", "Bob")

    conv_resp = await ac.post(
        "/api/conversations",
        json={"participant_id": bob["user"]["id"]},
        headers={**CLIENT, "Authorization": f"Bearer {alice['token']}"},
    )
    assert conv_resp.status_code == 200
    conv_id = conv_resp.json()["conversation"]["id"]

    send = await ac.post(
        f"/api/conversations/{conv_id}/messages",
        json={"ciphertext": VALID_B64},
        headers={**CLIENT, "Authorization": f"Bearer {alice['token']}"},
    )
    assert send.status_code == 200
    assert send.json()["message"]["protocol"] == "placeholder"

    listed = await ac.get(
        f"/api/conversations/{conv_id}/messages",
        headers={**CLIENT, "Authorization": f"Bearer {bob['token']}"},
    )
    assert listed.status_code == 200
    assert len(listed.json()["messages"]) == 1
    assert len(db["messages"].docs) == 1