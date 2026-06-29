import pytest
from datetime import timedelta
from unittest.mock import patch

from core.conversation_mutes import (
    android_channel_id_for_conversation,
    attach_mute_fields,
    clear_conversation_mute,
    is_conversation_muted,
    mute_conversation_for_user,
    set_conversation_mute,
    should_silence_push,
    unmute_conversation_for_user,
)
from core.utils import iso, now_utc


class _FakeDB:
    def __init__(self):
        self.conversation_mutes = _FakeCollection()
        self.conversations = _FakeCollection()
        self.contact_mutes = _FakeCollection()
        self.contact_rosters = _FakeCollection()

    def __getitem__(self, name):
        return getattr(self, name)


class _FakeCollection:
    def __init__(self):
        self.rows = []

    async def find_one(self, query, projection=None):
        for row in self.rows:
            if all(row.get(k) == v for k, v in query.items()):
                return row
        return None

    def find(self, query, projection=None):
        out = []
        for row in self.rows:
            if all(row.get(k) == v for k, v in query.items()):
                out.append(row)
        return _FakeCursor(out)

    async def update_one(self, query, update, upsert=False):
        existing = await self.find_one(query)
        if existing:
            if "$set" in update:
                existing.update(update["$set"])
            if "$setOnInsert" in update:
                for k, v in update["$setOnInsert"].items():
                    existing.setdefault(k, v)
            return
        if upsert:
            row = dict(query)
            if "$set" in update:
                row.update(update["$set"])
            if "$setOnInsert" in update:
                row.update(update["$setOnInsert"])
            self.rows.append(row)

    async def delete_one(self, query):
        before = len(self.rows)
        self.rows = [r for r in self.rows if not all(r.get(k) == v for k, v in query.items())]
        return type("R", (), {"deleted_count": before - len(self.rows)})()

    async def delete_many(self, query):
        before = len(self.rows)
        self.rows = [r for r in self.rows if not all(r.get(k) == v for k, v in query.items())]
        return type("R", (), {"deleted_count": before - len(self.rows)})()


class _FakeCursor:
    def __init__(self, items):
        self._items = items

    async def to_list(self, limit):
        return self._items[:limit]


@pytest.fixture
def mem_db():
    fake = _FakeDB()
    fake.conversations.rows.append({
        "conversation_id": "c_dm",
        "participants": ["u_a", "u_b"],
        "is_group": False,
    })
    fake.conversations.rows.append({
        "conversation_id": "c_grp",
        "participants": ["u_a", "u_b", "u_c"],
        "is_group": True,
    })
    return fake


@pytest.mark.asyncio
async def test_set_and_check_conversation_mute(mem_db):
    with patch("core.conversation_mutes.db", mem_db):
        await set_conversation_mute("u_a", "c_dm", duration="8h")
        assert await is_conversation_muted("u_a", "c_dm") is True
        assert await should_silence_push("u_a", "c_dm", "u_b") is True


@pytest.mark.asyncio
async def test_expired_mute_is_inactive(mem_db):
    past = iso(now_utc() - timedelta(hours=2))
    with patch("core.conversation_mutes.db", mem_db):
        from core.conversation_mutes import conversation_mute_seal

        mem_db.conversation_mutes.rows.append({
            "seal": conversation_mute_seal("u_a", "c_dm"),
            "user_id": "u_a",
            "conversation_id": "c_dm",
            "muted_until": past,
        })
        assert await is_conversation_muted("u_a", "c_dm") is False


@pytest.mark.asyncio
async def test_attach_mute_fields(mem_db):
    with patch("core.conversation_mutes.db", mem_db):
        await set_conversation_mute("u_a", "c_grp", duration="1h")
        convs = [{"conversation_id": "c_grp"}, {"conversation_id": "c_dm"}]
        await attach_mute_fields(convs, "u_a")
        assert convs[0]["muted"] is True
        assert convs[0].get("muted_until")
        assert not convs[1].get("muted")


@pytest.mark.asyncio
async def test_unmute_clears_mute(mem_db):
    with patch("core.conversation_mutes.db", mem_db), patch("core.contact_graph.db", mem_db):
        await mute_conversation_for_user("u_a", "c_dm", duration="forever")
        await unmute_conversation_for_user("u_a", "c_dm")
        assert await is_conversation_muted("u_a", "c_dm") is False


def test_android_channel_id_is_opaque():
    cid = android_channel_id_for_conversation("conv_secret_123")
    assert cid.startswith("ssc_chat_")
    assert "secret" not in cid
    assert len(cid) == len("ssc_chat_") + 12