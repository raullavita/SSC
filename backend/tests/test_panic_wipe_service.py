"""Panic wipe service tests — Engine 1 + Engine 5 session auth."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.panic_wipe import panic_wipe_user
from core.session_policy import SESSION_COOKIE_NAME
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


def _mock_collection(delete_count: int = 1):
    coll = MagicMock()
    result = MagicMock()
    result.deleted_count = delete_count
    coll.delete_many = AsyncMock(return_value=result)
    coll.find = MagicMock(return_value=_async_iter([]))
    coll.update_many = AsyncMock(return_value=MagicMock(modified_count=0))
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
            "call_sessions": _mock_collection(0),
            "groups": _mock_collection(0),
        }.get(name, default_coll)

    db.__getitem__.side_effect = getitem

    counts = await panic_wipe_user(db, "user-alice-123")
    assert counts["users"] == 1
    assert counts["devices"] == 2
    users.delete_many.assert_awaited()
    messages.delete_many.assert_not_awaited()


@pytest.mark.asyncio
async def test_panic_wipe_detaches_from_conversations_not_bulk_messages():
    db = MagicMock()
    conv_id = "conv-1"
    conversations = _mock_collection(0)
    conversations.find = MagicMock(return_value=_async_iter([]))
    conversations.update_many = AsyncMock(return_value=MagicMock(modified_count=1))
    conversations.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    messages = _mock_collection(5)
    groups = _mock_collection(0)
    groups.find = MagicMock(return_value=_async_iter([]))
    call_sessions = _mock_collection(0)
    call_sessions.update_many = AsyncMock(return_value=MagicMock(modified_count=0))
    call_sessions.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))

    default_coll = _mock_collection(0)

    def getitem(name):
        if name == "conversations":
            return conversations
        if name == "messages":
            return messages
        if name == "groups":
            return groups
        if name == "call_sessions":
            return call_sessions
        return default_coll

    db.__getitem__.side_effect = getitem

    counts = await panic_wipe_user(db, "user-bob")
    assert counts["conversations_detached"] == 1
    conversations.update_many.assert_awaited_with(
        {"participants": "user-bob"},
        {"$pull": {"participants": "user-bob"}},
    )
    messages.delete_many.assert_not_awaited()


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