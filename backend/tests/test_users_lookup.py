"""User lookup API tests — metadata-minimized responses."""

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
    for mod in ("routers.auth", "routers.users", "deps", "core.token_revocation"):
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
async def test_lookup_returns_id_and_display_name_only(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    alice, alice_cookies = await _register(transport, "lookup@example.com", "Alice")
    bob, _ = await _register(transport, "target@example.com", "Bob Target")
    bob_id = bob["user"]["id"]

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        resp = await ac.get(f"/api/users/lookup/{bob_id}", headers=CLIENT)
        assert resp.status_code == 200
        data = resp.json()["user"]
        assert data["id"] == bob_id
        assert data["display_name"] == "Bob Target"
        assert "email" not in data


@pytest.mark.asyncio
async def test_lookup_unknown_user_404(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    _, cookies = await _register(transport, "viewer@example.com", "Viewer")

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        resp = await ac.get("/api/users/lookup/u_does_not_exist", headers=CLIENT)
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_lookup_self_400(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    user, cookies = await _register(transport, "self@example.com", "Self")
    user_id = user["user"]["id"]

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        resp = await ac.get(f"/api/users/lookup/{user_id}", headers=CLIENT)
        assert resp.status_code == 400