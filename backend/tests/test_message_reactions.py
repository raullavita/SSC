import pytest
from fastapi import HTTPException

from core.message_reactions import (
    ALLOWED_REACTION_EMOJI,
    normalize_reaction_emoji,
    set_message_reaction,
)


def test_normalize_reaction_emoji_accepts_whitelist():
    for emoji in ALLOWED_REACTION_EMOJI:
        assert normalize_reaction_emoji(emoji) == emoji


def test_normalize_reaction_emoji_rejects_unknown():
    with pytest.raises(HTTPException):
        normalize_reaction_emoji("🚀")


@pytest.mark.asyncio
async def test_set_reaction_toggle_off(monkeypatch):
    deleted = {"called": False}

    class FakeReactions:
        async def find_one(self, query, projection):
            return {"emoji": "👍"}

        async def delete_one(self, query):
            deleted["called"] = True

        def find(self, query, projection):
            class Cursor:
                async def to_list(self, n):
                    return []

            return Cursor()

        async def update_one(self, *args, **kwargs):
            return None

    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_test",
                "message_type": "text",
            }

    class FakeConv:
        async def find_one(self, query, projection):
            return {"conversation_id": "c_test", "participants": ["u_me", "u_peer"]}

    class FakeDb:
        message_reactions = FakeReactions()
        messages = FakeMessages()
        conversations = FakeConv()

    async def fake_retention(_):
        return 24

    monkeypatch.setattr("core.message_reactions.db", FakeDb())
    monkeypatch.setattr(
        "core.message_reactions.get_effective_retention_for_conversation",
        fake_retention,
    )
    out = await set_message_reaction(
        user_id="u_me",
        conversation_id="c_test",
        message_id="m_abc123def45678",
        emoji="👍",
    )
    assert deleted["called"] is True
    assert out["reactions"] == []


@pytest.mark.asyncio
async def test_set_reaction_upserts_new(monkeypatch):
    updated = {}

    class FakeReactions:
        async def find_one(self, query, projection):
            return None

        async def delete_one(self, query):
            return None

        def find(self, query, projection):
            class Cursor:
                async def to_list(self, n):
                    return [{"user_id": "u_me", "emoji": "❤️"}]

            return Cursor()

        async def update_one(self, query, patch, upsert=False):
            updated["patch"] = patch

    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_test",
                "message_type": "text",
            }

    class FakeConv:
        async def find_one(self, query, projection):
            return {"conversation_id": "c_test", "participants": ["u_me", "u_peer"]}

    class FakeDb:
        message_reactions = FakeReactions()
        messages = FakeMessages()
        conversations = FakeConv()

    async def fake_retention(_):
        return 24

    monkeypatch.setattr("core.message_reactions.db", FakeDb())
    monkeypatch.setattr(
        "core.message_reactions.get_effective_retention_for_conversation",
        fake_retention,
    )
    out = await set_message_reaction(
        user_id="u_me",
        conversation_id="c_test",
        message_id="m_abc123def45678",
        emoji="❤️",
    )
    assert updated["patch"]["$set"]["emoji"] == "❤️"
    assert out["reactions"] == [{"user_id": "u_me", "emoji": "❤️"}]