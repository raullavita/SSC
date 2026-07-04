"""Read receipts + unread — Engine 4."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from core.read_receipts import increment_unread, mark_conversation_read


class _FakeCollection:
    def __init__(self):
        self.docs = {}

    async def update_one(self, query, update, upsert=False):
        key = (query.get("user_id"), query.get("conversation_id"))
        doc = self.docs.get(key, {})
        if "$inc" in update:
            doc["unread_count"] = int(doc.get("unread_count", 0)) + update["$inc"]["unread_count"]
        if "$set" in update:
            doc.update(update["$set"])
        if "$setOnInsert" in update and key not in self.docs:
            doc.update(update["$setOnInsert"])
        self.docs[key] = doc

    async def find_one(self, query):
        key = (query.get("user_id"), query.get("conversation_id"))
        if key in self.docs:
            return {"user_id": key[0], "conversation_id": key[1], **self.docs[key]}
        if query.get("_id"):
            return self.docs.get(query["_id"])
        return None

    async def insert_one(self, doc):
        if "_id" in doc:
            self.docs[doc["_id"]] = doc


class _FakeDb:
    def __init__(self):
        self.conversation_meta = _FakeCollection()
        self.users = _FakeCollection()
        self.messages = _FakeCollection()
        self.message_reads = _FakeCollection()


@pytest.mark.asyncio
async def test_increment_unread_skips_sender():
    db = _FakeDb()
    await increment_unread(db, "c_1", ["u_a", "u_b"], "u_a")
    meta = await db.conversation_meta.find_one({"user_id": "u_b", "conversation_id": "c_1"})
    assert meta["unread_count"] == 1


@pytest.mark.asyncio
async def test_mark_read_without_receipts_opt_in(monkeypatch):
    db = _FakeDb()
    await db.users.insert_one(
        {"_id": "u_b", "privacy_settings": {"read_receipts": False}}
    )
    await db.messages.insert_one(
        {
            "_id": "m_1",
            "conversation_id": "c_1",
            "sender_id": "u_a",
            "ciphertext": "abc",
        }
    )
    published = []

    async def fake_publish(topic, payload):
        published.append((topic, payload))

    monkeypatch.setattr("core.read_receipts.ws_hub.publish", fake_publish)

    receipt = await mark_conversation_read(db, "u_b", "c_1", "m_1")
    assert receipt is None
    assert len(published) == 0
    meta = await db.conversation_meta.find_one({"user_id": "u_b", "conversation_id": "c_1"})
    assert meta["unread_count"] == 0