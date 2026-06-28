import pytest
from fastapi import HTTPException

from core.message_polls import (
    MAX_POLL_OPTIONS,
    MIN_POLL_OPTIONS,
    normalize_poll_option_count,
    normalize_poll_option_index,
    set_poll_vote,
)


def test_normalize_poll_option_count_accepts_range():
    assert normalize_poll_option_count(MIN_POLL_OPTIONS) == MIN_POLL_OPTIONS
    assert normalize_poll_option_count(MAX_POLL_OPTIONS) == MAX_POLL_OPTIONS


def test_normalize_poll_option_count_rejects_invalid():
    with pytest.raises(HTTPException):
        normalize_poll_option_count(1)
    with pytest.raises(HTTPException):
        normalize_poll_option_count(99)


def test_normalize_poll_option_index_bounds():
    assert normalize_poll_option_index(0, 3) == 0
    assert normalize_poll_option_index(2, 3) == 2
    with pytest.raises(HTTPException):
        normalize_poll_option_index(3, 3)


@pytest.mark.asyncio
async def test_set_poll_vote_upserts(monkeypatch):
    updated = {}

    class FakeVotes:
        async def find_one(self, query, projection):
            return None

        def find(self, query, projection):
            class Cursor:
                async def to_list(self, n):
                    return [{"user_id": "u_me", "option_index": 1}]

            return Cursor()

        async def update_one(self, query, patch, upsert=False):
            updated["patch"] = patch

    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_test",
                "message_type": "poll",
                "poll_option_count": 3,
            }

    class FakeConv:
        async def find_one(self, query, projection):
            return {
                "conversation_id": "c_test",
                "is_group": True,
                "participants": ["u_me", "u_peer"],
            }

    class FakeDb:
        message_poll_votes = FakeVotes()
        messages = FakeMessages()
        conversations = FakeConv()

    async def fake_retention(_):
        return 24

    monkeypatch.setattr("core.message_polls.db", FakeDb())
    monkeypatch.setattr(
        "core.message_polls.get_effective_retention_for_conversation",
        fake_retention,
    )
    out = await set_poll_vote(
        user_id="u_me",
        conversation_id="c_test",
        message_id="m_abc123def45678",
        option_index=1,
    )
    assert updated["patch"]["$set"]["option_index"] == 1
    assert out["poll_votes"] == [{"user_id": "u_me", "option_index": 1}]


@pytest.mark.asyncio
async def test_set_poll_vote_rejects_dm(monkeypatch):
    class FakeConv:
        async def find_one(self, query, projection):
            return {
                "conversation_id": "c_test",
                "is_group": False,
                "participants": ["u_me", "u_peer"],
            }

    class FakeDb:
        conversations = FakeConv()

    monkeypatch.setattr("core.message_polls.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await set_poll_vote(
            user_id="u_me",
            conversation_id="c_test",
            message_id="m_abc123def45678",
            option_index=0,
        )
    assert exc.value.status_code == 403