"""Group chat API tests — Engine 9."""

from __future__ import annotations

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
        "routers.groups",
        "routers.conversations",
        "deps",
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
        return reg.json(), client.cookies


@pytest.mark.asyncio
async def test_create_group(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    alice, cookies = await _register(transport, "grp1@example.com", "Alice")
    bob, _ = await _register(transport, "grp2@example.com", "Bob")

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        resp = await ac.post(
            "/api/groups",
            json={"name": "Test Group", "member_ids": [bob["user"]["id"]]},
            headers=CLIENT,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["group"]["name"] == "Test Group"
        assert body["group"]["member_count"] == 2
        assert body["conversation_id"]
        assert len(fake_db["groups"].docs) == 1