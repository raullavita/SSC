"""Message fanout respects block policy."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from core.abuse_enforcement import record_user_block
from core.message_fanout import fanout_message
from tests.fake_mongo import FakeDatabase


@pytest.mark.asyncio
async def test_fanout_skips_user_topic_for_blocked_recipient(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("core.message_fanout.ws_hub.publish", publish_mock)

    now = datetime.now(timezone.utc)
    await record_user_block(fake_db, "u_b", "u_a")
    doc = {
        "_id": "m1",
        "conversation_id": "c1",
        "sender_id": "u_a",
        "ciphertext": "Y2lwaGVy",
        "protocol": "signal_v1",
        "created_at": now,
    }

    await fanout_message("c1", doc, ["u_a", "u_b", "u_c"], "u_a")

    user_topics = [args[0] for args, _ in publish_mock.await_args_list if args[0].startswith("user:")]
    assert "user:u_b" not in user_topics
    assert "user:u_c" in user_topics
    assert "user:u_a" in user_topics