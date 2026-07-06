"""Step 9 — read receipts UI + fanout (privacy opt-in)."""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in ("routers.auth", "routers.conversations", "routers.users", "deps", "core.token_revocation"):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


@pytest.mark.asyncio
async def test_list_reads_route_metadata_minimal(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "sender@example.com", "password": "password123", "display_name": "Sender"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "reader@example.com", "password": "password123", "display_name": "Reader"},
        )
        assert reg_a.status_code == 200
        assert reg_b.status_code == 200
        sender_id = reg_a.json()["user"]["id"]
        reader_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": reader_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        await fake_db.users.update_one(
            {"_id": reader_id},
            {"$set": {"privacy_settings": {"read_receipts": True}}},
        )
        await fake_db.messages.insert_one(
            {
                "_id": "m_step9",
                "conversation_id": conv_id,
                "sender_id": sender_id,
                "ciphertext": "abc",
                "protocol": "signal_v1",
            }
        )

        published = []

        async def capture(topic, payload):
            published.append((topic, payload))

        monkeypatch.setattr("core.read_receipts.ws_hub.publish", capture)

        mark = await client.post(
            f"/api/conversations/{conv_id}/read",
            json={"last_message_id": "m_step9"},
            cookies=reg_b.cookies,
        )
        assert mark.status_code == 200
        assert mark.json()["receipt_sent"] is True

        listed = await client.get(f"/api/conversations/{conv_id}/reads", cookies=reg_a.cookies)
        assert listed.status_code == 200
        reads = listed.json()["reads"]
        assert len(reads) == 1
        assert reads[0]["message_id"] == "m_step9"
        assert "read_at" in reads[0]
        assert "reader_id" not in reads[0]


def test_step9_frontend_hook_exists():
    repo = Path(__file__).resolve().parents[2]
    hook = (repo / "frontend" / "src" / "chat" / "useReadReceipts.js").read_text(encoding="utf-8")
    assert "user:${userId}" in hook
    assert "/reads" in hook


def test_message_bubble_read_marks():
    repo = Path(__file__).resolve().parents[2]
    bubble = (repo / "frontend" / "src" / "components" / "chat" / "MessageBubble.jsx").read_text(
        encoding="utf-8"
    )
    assert "readAt" in bubble
    assert "✓✓" in bubble