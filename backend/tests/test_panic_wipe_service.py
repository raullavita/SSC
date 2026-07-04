"""Panic wipe service tests — Engine 1."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from core.panic_wipe import panic_wipe_user


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
async def test_panic_wipe_api_route(client, monkeypatch):
    async def fake_report(db, user_id):
        return {"user_id": user_id, "deleted": {"users": 1}, "total": 1}

    monkeypatch.setattr("routers.panic.panic_wipe_user_and_report", fake_report)

    response = await client.post("/api/panic/wipe")
    assert response.status_code == 401

    response = await client.post(
        "/api/panic/wipe",
        headers={"X-SSC-User-Id": "test-user-1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["user_id"] == "test-user-1"
    assert body["total"] == 1