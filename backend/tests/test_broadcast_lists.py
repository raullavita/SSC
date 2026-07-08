"""Broadcast list CRUD tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase
from tests.test_engine3_messaging import CLIENT, _patch_db

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def broadcast_env(monkeypatch):
    fake_db = FakeDatabase()
    _patch_db(monkeypatch, fake_db)
    monkeypatch.setattr("routers.broadcast_lists.get_database", lambda: fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    yield fake_db, transport


async def _register(transport, email: str, name: str):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        assert response.status_code == 200
        return response.json(), client.cookies


async def test_broadcast_list_crud(broadcast_env):
    _, transport = broadcast_env
    owner_body, owner_cookies = await _register(transport, "owner@example.com", "Owner")
    peer_body, _ = await _register(transport, "peer@example.com", "Peer")
    owner_id = owner_body["user"]["id"]
    peer_id = peer_body["user"]["id"]
    assert owner_id != peer_id

    async with AsyncClient(transport=transport, base_url="http://test", cookies=owner_cookies) as client:
        create = await client.post(
            "/api/broadcast_lists",
            json={"name": "Team", "recipient_ids": [peer_id]},
            headers=CLIENT,
        )
        assert create.status_code == 200
        created = create.json()["broadcast_list"]
        assert created["name"] == "Team"
        assert created["recipient_ids"] == [peer_id]
        list_id = created["id"]

        listed = await client.get("/api/broadcast_lists", headers=CLIENT)
        assert listed.status_code == 200
        assert len(listed.json()["broadcast_lists"]) == 1

        patched = await client.patch(
            f"/api/broadcast_lists/{list_id}",
            json={"name": "Squad"},
            headers=CLIENT,
        )
        assert patched.status_code == 200
        assert patched.json()["broadcast_list"]["name"] == "Squad"

        deleted = await client.delete(f"/api/broadcast_lists/{list_id}", headers=CLIENT)
        assert deleted.status_code == 200
        assert deleted.json()["ok"] is True

        empty = await client.get("/api/broadcast_lists", headers=CLIENT)
        assert empty.json()["broadcast_lists"] == []