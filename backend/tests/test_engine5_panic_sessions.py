"""Engine 5 panic wipe revokes sessions."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.session_policy import SESSION_COOKIE_NAME
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


@pytest.fixture
async def panic_client(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    monkeypatch.setattr("routers.auth.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.panic.get_database", lambda: fake_db)
    monkeypatch.setattr("deps.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    async def fake_report(db, user_id):
        return {"user_id": user_id, "deleted": {"users": 1}, "total": 1}

    monkeypatch.setattr("routers.panic.panic_wipe_user_and_report", fake_report)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, fake_db


@pytest.mark.asyncio
async def test_panic_wipe_requires_session(panic_client):
    ac, _ = panic_client
    response = await ac.post("/api/panic/wipe", headers=CLIENT)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_panic_wipe_revokes_sessions(panic_client, monkeypatch):
    ac, db = panic_client
    revoke_mock = AsyncMock(return_value=2)
    monkeypatch.setattr("routers.panic.revoke_all_user_sessions", revoke_mock)

    reg = await ac.post(
        "/api/auth/register",
        json={
            "email": "panic@example.com",
            "password": "password123",
            "display_name": "Panic User",
        },
        headers=CLIENT,
    )
    assert reg.status_code == 200
    assert SESSION_COOKIE_NAME in reg.cookies

    response = await ac.post("/api/panic/wipe", headers=CLIENT)
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    revoke_mock.assert_awaited_once()