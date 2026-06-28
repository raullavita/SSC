from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from core.message_delete import (
    is_message_deleted,
    message_within_retention,
    tombstone_update,
    unsend_message_for_everyone,
)


def test_is_message_deleted_detects_tombstone():
    assert is_message_deleted({"message_type": "deleted"}) is True
    assert is_message_deleted({"deleted_for_everyone_at": "2026-01-01T00:00:00+00:00"}) is True
    assert is_message_deleted({"message_type": "text"}) is False


def test_message_within_retention_future_expiry():
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    assert message_within_retention({"expires_at": future}) is True


def test_message_within_retention_past_expiry():
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    assert message_within_retention({"expires_at": past}) is False


def test_tombstone_clears_payload():
    patch = tombstone_update("u_sender")
    assert patch["message_type"] == "deleted"
    assert patch["ciphertext"] == ""
    assert patch["attachment_id"] is None


@pytest.mark.asyncio
async def test_unsend_rejects_non_sender(monkeypatch):
    future = datetime.now(timezone.utc) + timedelta(hours=1)

    class FakeCol:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_test",
                "sender_id": "u_other",
                "message_type": "text",
                "expires_at": future,
            }

        async def update_one(self, *args, **kwargs):
            return None

    class FakeDb:
        messages = FakeCol()
        files = FakeCol()

    monkeypatch.setattr("core.message_delete.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await unsend_message_for_everyone(
            message_id="m_abc123def45678",
            conversation_id="c_test",
            user_id="u_me",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_unsend_ok(monkeypatch):
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    updated = {}

    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_test",
                "sender_id": "u_me",
                "message_type": "text",
                "ciphertext": "cipher",
                "expires_at": future,
            }

        async def update_one(self, query, patch):
            updated["patch"] = patch

    class FakeFiles:
        async def find_one(self, query, projection):
            return None

    class FakeDb:
        messages = FakeMessages()
        files = FakeFiles()

    monkeypatch.setattr("core.message_delete.db", FakeDb())
    out = await unsend_message_for_everyone(
        message_id="m_abc123def45678",
        conversation_id="c_test",
        user_id="u_me",
    )
    assert out["message_type"] == "deleted"
    assert updated["patch"]["$set"]["message_type"] == "deleted"