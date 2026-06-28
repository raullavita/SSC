import pytest
from fastapi import HTTPException

from core.message_replies import normalize_reply_to_message_id, validate_reply_target


def test_normalize_reply_accepts_message_id():
    assert normalize_reply_to_message_id("m_abc123def45678") == "m_abc123def45678"


def test_normalize_reply_rejects_invalid():
    with pytest.raises(HTTPException):
        normalize_reply_to_message_id("not-a-message-id")


@pytest.mark.asyncio
async def test_validate_reply_target_missing_message(monkeypatch):
    class FakeCol:
        async def find_one(self, query, projection):
            return None

    class FakeDb:
        messages = FakeCol()

    monkeypatch.setattr("core.message_replies.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await validate_reply_target("c_test", "m_abc123def45678")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_validate_reply_target_ok(monkeypatch):
    class FakeCol:
        async def find_one(self, query, projection):
            return {"_id": 1}

    class FakeDb:
        messages = FakeCol()

    monkeypatch.setattr("core.message_replies.db", FakeDb())
    out = await validate_reply_target("c_test", "m_abc123def45678")
    assert out == "m_abc123def45678"