import pytest
from fastapi import HTTPException

from core.message_forwards import validate_forward_source


@pytest.mark.asyncio
async def test_validate_forward_rejects_deleted_source(monkeypatch):
    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_src",
                "message_type": "text",
                "deleted_for_everyone_at": "2026-01-01T00:00:00+00:00",
            }

    class FakeDb:
        messages = FakeMessages()
        conversations = None

    monkeypatch.setattr("core.message_forwards.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await validate_forward_source(
            user_id="u_me",
            forwarded_from_message_id="m_abc123def45678",
            target_conversation_id="c_dst",
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_validate_forward_requires_mutual_contact_for_dm(monkeypatch):
    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_src",
                "message_type": "text",
            }

    class FakeConversations:
        async def find_one(self, query, projection):
            if query.get("conversation_id") == "c_src":
                return {"conversation_id": "c_src", "participants": ["u_me", "u_peer"]}
            return {
                "conversation_id": "c_dst",
                "participants": ["u_me", "u_other"],
                "is_group": False,
            }

    async def fake_are_contacts(a, b):
        return False

    class FakeDb:
        messages = FakeMessages()
        conversations = FakeConversations()

    monkeypatch.setattr("core.message_forwards.db", FakeDb())
    monkeypatch.setattr("core.message_forwards.are_contacts", fake_are_contacts)
    with pytest.raises(HTTPException) as exc:
        await validate_forward_source(
            user_id="u_me",
            forwarded_from_message_id="m_abc123def45678",
            target_conversation_id="c_dst",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_validate_forward_ok_for_group_target(monkeypatch):
    class FakeMessages:
        async def find_one(self, query, projection):
            return {
                "message_id": "m_abc123def45678",
                "conversation_id": "c_src",
                "message_type": "text",
            }

    class FakeConversations:
        async def find_one(self, query, projection):
            if query.get("conversation_id") == "c_src":
                return {"conversation_id": "c_src", "participants": ["u_me", "u_peer"]}
            return {
                "conversation_id": "g_dst",
                "participants": ["u_me", "u_a", "u_b"],
                "is_group": True,
            }

    class FakeDb:
        messages = FakeMessages()
        conversations = FakeConversations()

    monkeypatch.setattr("core.message_forwards.db", FakeDb())
    out = await validate_forward_source(
        user_id="u_me",
        forwarded_from_message_id="m_abc123def45678",
        target_conversation_id="g_dst",
    )
    assert out == "m_abc123def45678"