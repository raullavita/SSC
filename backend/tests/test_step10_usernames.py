"""Step 10 — usernames + invite links."""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in ("routers.auth", "routers.users", "routers.conversations", "deps", "core.token_revocation"):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


@pytest.mark.asyncio
async def test_set_and_lookup_username(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "alice@example.com", "password": "password123", "display_name": "Alice"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "bob@example.com", "password": "password123", "display_name": "Bob"},
        )
        assert reg_a.status_code == 200
        assert reg_b.status_code == 200

        set_name = await client.patch(
            "/api/users/me/username",
            json={"username": "alice"},
            cookies=reg_a.cookies,
        )
        assert set_name.status_code == 200
        assert set_name.json()["user"]["username"] == "alice"

        by_name = await client.get("/api/users/by-username/alice", cookies=reg_b.cookies)
        assert by_name.status_code == 200
        assert by_name.json()["user"]["username"] == "alice"
        assert "email" not in by_name.json()["user"]

        via_lookup = await client.get("/api/users/lookup/@alice", cookies=reg_b.cookies)
        assert via_lookup.status_code == 200
        assert via_lookup.json()["user"]["id"] == reg_a.json()["user"]["id"]


@pytest.mark.asyncio
async def test_username_taken_conflict(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "a@example.com", "password": "password123", "display_name": "A"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "b@example.com", "password": "password123", "display_name": "B"},
        )
        await client.patch(
            "/api/users/me/username",
            json={"username": "taken"},
            cookies=reg_a.cookies,
        )
        conflict = await client.patch(
            "/api/users/me/username",
            json={"username": "taken"},
            cookies=reg_b.cookies,
        )
        assert conflict.status_code == 409


def test_step10_frontend_invite_files_exist():
    repo = Path(__file__).resolve().parents[2]
    assert (repo / "frontend" / "src" / "lib" / "inviteLink.js").is_file()
    assert (repo / "frontend" / "src" / "pages" / "AddContact.jsx").is_file()
    assert (repo / "frontend" / "src" / "pages" / "AddContactLanding.jsx").is_file()