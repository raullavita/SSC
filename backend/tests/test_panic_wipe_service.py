"""Panic wipe service tests — Engine 1 + Engine 5 session auth."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.panic_wipe import panic_wipe_user
from core.session_policy import SESSION_COOKIE_NAME
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}


def _mock_collection(delete_count: int = 1):
    coll = MagicMock()
    result = MagicMock()
    result.deleted_count = delete_count
    coll.delete_many = AsyncMock(return_value=result)
    coll.find = MagicMock(return_value=_async_iter([]))
    return coll


def _async_iter(items):
    async def _gen():
        for item in items:
            yield item

    return _gen()


@pytest.mark.asyncio
async def test_panic_wipe_deletes_user_row():
    db = MagicMock()
    users = _mock_collection(1)
    devices = _mock_collection(2)
    conversations = _mock_collection(0)
    conversations.find = MagicMock(return_value=_async_iter([]))
    messages = _mock_collection(0)
    default_coll = _mock_collection(0)

    def getitem(name):
        return {
            "users": users,
            "devices": devices,
            "conversations": conversations,
            "messages": messages,
        }.get(name, default_coll)

    db.__getitem__.side_effect = getitem

    counts = await panic_wipe_user(db, "user-alice-123")
    assert counts["users"] == 1
    assert counts["devices"] == 2
    users.delete_many.assert_awaited()


@pytest.mark.asyncio
async def test_panic_wipe_clears_conversation_messages():
    db = MagicMock()
    conv_id = "conv-1"
    conversations = _mock_collection(1)
    conversations.find = MagicMock(
        return_value=_async_iter([{"_id": conv_id}])
    )
    messages = _mock_collection(5)

    default_coll = _mock_collection(0)

    def getitem(name):
        if name == "conversations":
            return conversations
        if name == "messages":
            return messages
        return default_coll

    db.__getitem__.side_effect = getitem

    counts = await panic_wipe_user(db, "user-bob")
    assert counts["messages"] == 5
    messages.delete_many.assert_awaited_with({"conversation_id": {"$in": [conv_id]}})


@pytest.mark.asyncio
async def test_panic_wipe_api_route_requires_session(monkeypatch):
    fake_db = FakeDatabase()
    async def _no_redis():
        return None

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
    monkeypatch.setattr("routers.panic.revoke_all_user_sessions", AsyncMock(return_value=1))

    app = create_app()
    app.state.enforce_installed_client = False
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/panic/wipe")
        assert response.status_code == 401

        reg = await client.post(
            "/api/auth/register",
            json={
                "email": "panic-route@example.com",
                "password": "password123",
                "display_name": "Panic Route",
            },
            headers=CLIENT,
        )
        assert reg.status_code == 200
        assert SESSION_COOKIE_NAME in reg.cookies

        response = await client.post("/api/panic/wipe", headers=CLIENT)
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["total"] == 1