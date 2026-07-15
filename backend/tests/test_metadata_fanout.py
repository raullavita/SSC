"""Metadata fanout tests — Step 6."""

from __future__ import annotations

import pytest

from core.message_fanout import fanout_message
from tests.fake_mongo import FakeDatabase


@pytest.mark.asyncio
async def test_fanout_omits_participants_from_conversation_topic(monkeypatch):
    published: list[tuple[str, dict]] = []

    async def fake_publish(topic: str, payload: dict) -> None:
        published.append((topic, payload))

    monkeypatch.setattr("core.message_fanout.ws_hub.publish", fake_publish)
    monkeypatch.setattr("db.get_database", lambda: FakeDatabase())

    async def fake_device_ids(_db, _uid):
        return ["1"]

    monkeypatch.setattr("core.message_fanout.participant_device_ids", fake_device_ids)

    doc = {
        "_id": "m_1",
        "conversation_id": "c_1",
        "sender_id": "u_a",
        "ciphertext": "aGVsbG8=",
        "protocol": "signal_v1",
        "created_at": None,
    }
    await fanout_message("c_1", doc, ["u_a", "u_b"], "u_a")

    conv_payload = next(p for topic, p in published if topic == "conversation:c_1")
    assert "participants" not in conv_payload
    assert conv_payload["type"] == "message"
    assert "message" in conv_payload
    assert "device_ciphertexts" not in conv_payload.get("message", {})