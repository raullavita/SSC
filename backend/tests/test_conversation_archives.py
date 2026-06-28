import pytest
from fastapi import HTTPException

from core.conversation_archives import (
    MAX_ARCHIVES_PER_USER,
    archive_conversation,
    attach_archive_fields,
    sort_archived_conversations,
    unarchive_conversation,
)


def test_sort_archived_conversations_by_archived_at_desc():
    convs = [
        {"conversation_id": "c1", "archived": True, "archived_at": "2026-06-29T09:00:00+00:00"},
        {"conversation_id": "c2", "archived": False},
        {"conversation_id": "c3", "archived": True, "archived_at": "2026-06-29T11:00:00+00:00"},
    ]
    ordered = sort_archived_conversations(convs)
    assert [c["conversation_id"] for c in ordered] == ["c3", "c1"]


@pytest.mark.asyncio
async def test_attach_archive_fields_marks_viewer_archives(monkeypatch):
    class FakeArchives:
        def find(self, query, projection):
            class Cursor:
                async def to_list(self, n):
                    return [
                        {"conversation_id": "c_arch", "archived_at": "2026-06-29T08:00:00+00:00"},
                    ]

            return Cursor()

    class FakeDb:
        conversation_archives = FakeArchives()

    monkeypatch.setattr("core.conversation_archives.db", FakeDb())
    convs = [
        {"conversation_id": "c_arch"},
        {"conversation_id": "c_other"},
    ]
    out = await attach_archive_fields(convs, "u_me")
    assert out[0]["archived"] is True
    assert out[0]["archived_at"] == "2026-06-29T08:00:00+00:00"
    assert out[1]["archived"] is False


@pytest.mark.asyncio
async def test_archive_conversation_unpins_and_enforces_max(monkeypatch):
    inserted = {}
    unpinned = {"called": False}

    class FakeArchives:
        async def find_one(self, query, projection):
            return None

        async def count_documents(self, query):
            return MAX_ARCHIVES_PER_USER

        async def insert_one(self, doc):
            inserted["doc"] = doc

    class FakePins:
        async def delete_one(self, query):
            unpinned["called"] = True

    class FakeConv:
        async def find_one(self, query, projection):
            return {
                "conversation_id": "c_test",
                "participants": ["u_me", "u_peer"],
                "pinned": True,
                "pinned_at": "2026-06-29T08:00:00+00:00",
            }

    class FakeDb:
        conversation_archives = FakeArchives()
        conversation_pins = FakePins()
        conversations = FakeConv()

    monkeypatch.setattr("core.conversation_archives.db", FakeDb())
    with pytest.raises(HTTPException) as exc:
        await archive_conversation("u_me", "c_test")
    assert exc.value.status_code == 400

    class FakeArchivesOk(FakeArchives):
        async def count_documents(self, query):
            return 0

        async def insert_one(self, doc):
            inserted["doc"] = doc

    FakeDb.conversation_archives = FakeArchivesOk()
    out = await archive_conversation("u_me", "c_test")
    assert inserted["doc"]["conversation_id"] == "c_test"
    assert unpinned["called"] is True
    assert out["archived"] is True
    assert out["pinned"] is False


@pytest.mark.asyncio
async def test_unarchive_conversation_removes_archive(monkeypatch):
    deleted = {"called": False}

    class FakeArchives:
        async def delete_one(self, query):
            deleted["called"] = True

    class FakeConv:
        async def find_one(self, query, projection):
            return {
                "conversation_id": "c_test",
                "participants": ["u_me", "u_peer"],
                "archived": True,
                "archived_at": "2026-06-29T08:00:00+00:00",
            }

    class FakeDb:
        conversation_archives = FakeArchives()
        conversations = FakeConv()

    monkeypatch.setattr("core.conversation_archives.db", FakeDb())
    out = await unarchive_conversation("u_me", "c_test")
    assert deleted["called"] is True
    assert out["archived"] is False
    assert "archived_at" not in out