"""Session cookie auth tests — Engine 5."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from core.session_policy import SESSION_COOKIE_NAME
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}


async def _no_redis():
    return None


@pytest.fixture
async def session_client(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    monkeypatch.setattr("routers.auth.get_database", lambda: fake_db)
    monkeypatch.setattr("deps.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, fake_db


@pytest.mark.asyncio
async def test_register_sets_httponly_cookie(session_client):
    ac, db = session_client
    response = await ac.post(
        "/api/auth/register",
        json={
            "email": "cookie@example.com",
            "password": "password123",
            "display_name": "Cookie User",
        },
        headers=CLIENT,
    )
    assert response.status_code == 200
    body = response.json()
    assert "token" not in body
    assert SESSION_COOKIE_NAME in response.cookies
    assert len(db["sessions"].docs) == 1


@pytest.mark.asyncio
async def test_logout_revokes_session(session_client):
    ac, db = session_client
    reg = await ac.post(
        "/api/auth/register",
        json={
            "email": "logout@example.com",
            "password": "password123",
            "display_name": "Logout User",
        },
        headers=CLIENT,
    )
    assert reg.status_code == 200
    jti = db["sessions"].docs[0]["_id"]

    logout = await ac.post("/api/auth/logout", headers=CLIENT)
    assert logout.status_code == 200
    assert SESSION_COOKIE_NAME not in logout.cookies or logout.cookies.get(SESSION_COOKIE_NAME) == ""

    me = await ac.get("/api/auth/me", headers=CLIENT)
    assert me.status_code == 401

    session_doc = await db["sessions"].find_one({"_id": jti})
    assert session_doc is not None
    assert session_doc["revoked"] is True