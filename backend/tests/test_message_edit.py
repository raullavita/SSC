from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from core.message_edit import (
    EDIT_WINDOW_MINUTES,
    edit_message_text,
    is_editable_text_message,
    message_within_edit_window,
)


def test_is_editable_text_message():
    assert is_editable_text_message({"message_type": "text"}) is True
    assert is_editable_text_message({"message_type": "image", "attachment_id": "f_1"}) is False
    assert is_editable_text_message({"message_type": "deleted", "deleted_for_everyone_at": "x"}) is False


def test_message_within_edit_window_recent():
    created = datetime.now(timezone.utc) - timedelta(minutes=5)
    assert message_within_edit_window({"created_at": created}) is True


def test_message_within_edit_window_expired():
    created = datetime.now(timezone.utc) - timedelta(minutes=EDIT_WINDOW_MINUTES + 1)
    assert message_within_edit_window({"created_at": created}) is False


@pytest.mark.asyncio
async def test_edit_rejects_non_sender(monkeypatch):
    created = datetime.now(timezone.utc) - timedelta(minutes=1)
    future = datetime.now(timezone.utc) + timedelta(hours=1)

    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_test",
                "sender_id": "u_other",
                "message_type": "text",
                "protocol": "signal_v1",
                "created_at": created.isoformat(),
                "expires_at": future,
            }

        async def update_one(self, *args, **kwargs):
            return None

    class FakeConv:
        async def find_one(self, query, projection):
            return {"conversation_id": "c_test", "is_group": False, "participants": ["u_me", "u_other"]}

    class FakeDb:
        messages = FakeMessages()
        conversations = FakeConv()

    monkeypatch.setattr("core.message_edit.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await edit_message_text(
            message_id="m_abc123def45678",
            conversation_id="c_test",
            user_id="u_me",
            protocol="signal_v1",
            ciphertext="dGVzdGNpcGhlcnRleHQxMjM0NTY=",
            signal_message_type=2,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_edit_rejects_expired_window(monkeypatch):
    created = datetime.now(timezone.utc) - timedelta(minutes=EDIT_WINDOW_MINUTES + 5)
    future = datetime.now(timezone.utc) + timedelta(hours=1)

    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_test",
                "sender_id": "u_me",
                "message_type": "text",
                "protocol": "signal_v1",
                "created_at": created.isoformat(),
                "expires_at": future,
            }

        async def update_one(self, *args, **kwargs):
            return None

    class FakeConv:
        async def find_one(self, query, projection):
            return {"conversation_id": "c_test", "is_group": False, "participants": ["u_me", "u_other"]}

    class FakeDb:
        messages = FakeMessages()
        conversations = FakeConv()

    monkeypatch.setattr("core.message_edit.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await edit_message_text(
            message_id="m_abc123def45678",
            conversation_id="c_test",
            user_id="u_me",
            protocol="signal_v1",
            ciphertext="dGVzdGNpcGhlcnRleHQxMjM0NTY=",
            signal_message_type=2,
        )
    assert exc.value.status_code == 400