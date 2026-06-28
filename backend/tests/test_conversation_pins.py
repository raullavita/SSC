import pytest
from fastapi import HTTPException

from core.conversation_pins import (
    MAX_PINS_PER_USER,
    attach_pin_fields,
    pin_conversation,
    sort_conversations_for_sidebar,
    unpin_conversation,
)


def test_sort_conversations_for_sidebar_pins_first():
    convs = [
        {"conversation_id": "c1", "pinned": False, "created_at": "2026-06-29T10:00:00+00:00"},
        {"conversation_id": "c2", "pinned": True, "pinned_at": "2026-06-29T09:00:00+00:00"},
        {"conversation_id": "c3", "pinned": True, "pinned_at": "2026-06-29T11:00:00+00:00"},
        {"conversation_id": "c4", "pinned": False, "last_activity_at": "2026-06-29T12:00:00+00:00"},
    ]
    ordered = sort_conversations_for_sidebar(convs)
    assert [c["conversation_id"] for c in ordered] == ["c3", "c2", "c4", "c1"]


@pytest.mark.asyncio
async def test_attach_pin_fields_marks_viewer_pins(monkeypatch):
    class FakePins:
        def find(self, query, projection):
            class Cursor:
                async def to_list(self, n):
                    return [
                        {"conversation_id": "c_pin", "pinned_at": "2026-06-29T08:00:00+00:00"},
                    ]

            return Cursor()

    class FakeDb:
        conversation_pins = FakePins()

    monkeypatch.setattr("core.conversation_pins.db", FakeDb())
    convs = [
        {"conversation_id": "c_pin"},
        {"conversation_id": "c_other"},
    ]
    out = await attach_pin_fields(convs, "u_me")
    assert out[0]["pinned"] is True
    assert out[0]["pinned_at"] == "2026-06-29T08:00:00+00:00"
    assert out[1]["pinned"] is False


@pytest.mark.asyncio
async def test_pin_conversation_enforces_max(monkeypatch):
    class FakePins:
        async def find_one(self, query, projection):
            return None

        async def count_documents(self, query):
            return MAX_PINS_PER_USER

        async def insert_one(self, doc):
            return None

    class FakeConv:
        async def find_one(self, query, projection):
            return {"conversation_id": "c_test", "participants": ["u_me", "u_peer"]}

    class FakeDb:
        conversation_pins = FakePins()
        conversations = FakeConv()

    monkeypatch.setattr("core.conversation_pins.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await pin_conversation("u_me", "c_test")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_unpin_conversation_removes_pin(monkeypatch):
    deleted = {"called": False}

    class FakePins:
        async def delete_one(self, query):
            deleted["called"] = True

    class FakeConv:
        async def find_one(self, query, projection):
            return {
                "conversation_id": "c_test",
                "participants": ["u_me", "u_peer"],
                "pinned": True,
                "pinned_at": "2026-06-29T08:00:00+00:00",
            }

    class FakeDb:
        conversation_pins = FakePins()
        conversations = FakeConv()

    monkeypatch.setattr("core.conversation_pins.db", FakeDb())
    out = await unpin_conversation("u_me", "c_test")
    assert deleted["called"] is True
    assert out["pinned"] is False
    assert "pinned_at" not in out