"""Step 12 — message edit, delete, forward."""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.message_lifecycle_policy import (
    DELETE_FOR_EVERYONE_WINDOW_SECONDS,
    EDIT_WINDOW_SECONDS,
    can_delete_for_everyone,
    can_edit_message,
)
from core.signal_policy import SIGNAL_PROTOCOL_V1
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.conversations",
        "routers.messages",
        "deps",
        "push",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


def _ciphertext() -> str:
    return base64.b64encode(b"x" * 32).decode()


@pytest.mark.asyncio
async def test_edit_message_within_window(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("core.message_fanout.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "alice@example.com", "password": "password123", "display_name": "Alice"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "bob@example.com", "password": "password123", "display_name": "Bob"},
        )
        alice_id = reg_a.json()["user"]["id"]
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        send = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": _ciphertext(), "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_a.cookies,
        )
        msg_id = send.json()["message"]["id"]

        edited_cipher = base64.b64encode(b"y" * 32).decode()
        edit = await client.patch(
            f"/api/messages/{msg_id}",
            json={"ciphertext": edited_cipher, "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_a.cookies,
        )
        assert edit.status_code == 200
        assert edit.json()["message"]["ciphertext"] == edited_cipher
        assert edit.json()["message"].get("edited_at")

    publish_mock.assert_awaited()


@pytest.mark.asyncio
async def test_edit_message_denied_for_non_sender(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "a1@example.com", "password": "password123", "display_name": "A1"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "b1@example.com", "password": "password123", "display_name": "B1"},
        )
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        send = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": _ciphertext(), "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_a.cookies,
        )
        msg_id = send.json()["message"]["id"]

        edit = await client.patch(
            f"/api/messages/{msg_id}",
            json={"ciphertext": _ciphertext(), "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_b.cookies,
        )
        assert edit.status_code == 403
        assert edit.json()["detail"] == "not_message_sender"


@pytest.mark.asyncio
async def test_delete_for_me_hides_from_list(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "del_a@example.com", "password": "password123", "display_name": "DelA"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "del_b@example.com", "password": "password123", "display_name": "DelB"},
        )
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        send = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": _ciphertext(), "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_a.cookies,
        )
        msg_id = send.json()["message"]["id"]

        delete = await client.delete(f"/api/messages/{msg_id}?scope=me", cookies=reg_b.cookies)
        assert delete.status_code == 200

        listed = await client.get(f"/api/conversations/{conv_id}/messages", cookies=reg_b.cookies)
        assert listed.status_code == 200
        assert listed.json()["messages"] == []

        listed_a = await client.get(f"/api/conversations/{conv_id}/messages", cookies=reg_a.cookies)
        assert len(listed_a.json()["messages"]) == 1


@pytest.mark.asyncio
async def test_delete_for_everyone_tombstone(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("core.message_fanout.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "tomb_a@example.com", "password": "password123", "display_name": "TombA"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "tomb_b@example.com", "password": "password123", "display_name": "TombB"},
        )
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        send = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": _ciphertext(), "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_a.cookies,
        )
        msg_id = send.json()["message"]["id"]

        delete = await client.delete(
            f"/api/messages/{msg_id}?scope=everyone",
            cookies=reg_a.cookies,
        )
        assert delete.status_code == 200
        assert delete.json()["message"]["message_kind"] == "deleted"
        assert "ciphertext" not in delete.json()["message"]

        listed = await client.get(f"/api/conversations/{conv_id}/messages", cookies=reg_b.cookies)
        assert listed.json()["messages"][0]["message_kind"] == "deleted"


@pytest.mark.asyncio
async def test_forward_message_with_metadata(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "fwd_a@example.com", "password": "password123", "display_name": "FwdA"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "fwd_b@example.com", "password": "password123", "display_name": "FwdB"},
        )
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        original = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": _ciphertext(), "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_a.cookies,
        )
        original_id = original.json()["message"]["id"]

        forwarded = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={
                "ciphertext": _ciphertext(),
                "protocol": SIGNAL_PROTOCOL_V1,
                "forwarded_from": original_id,
            },
            cookies=reg_b.cookies,
        )
        assert forwarded.status_code == 200
        assert forwarded.json()["message"]["forwarded_from"] == original_id


def test_lifecycle_policy_windows():
    now = datetime.now(timezone.utc)
    doc = {
        "_id": "m1",
        "sender_id": "u1",
        "message_kind": "message",
        "created_at": now - timedelta(seconds=EDIT_WINDOW_SECONDS - 10),
    }
    ok, _ = can_edit_message(doc, "u1", now)
    assert ok

    old = {**doc, "created_at": now - timedelta(seconds=EDIT_WINDOW_SECONDS + 1)}
    ok, detail = can_edit_message(old, "u1", now)
    assert not ok
    assert detail == "edit_window_expired"

    ok, _ = can_delete_for_everyone(doc, "u1", now)
    assert ok
    very_old = {**doc, "created_at": now - timedelta(seconds=DELETE_FOR_EVERYONE_WINDOW_SECONDS + 1)}
    ok, detail = can_delete_for_everyone(very_old, "u1", now)
    assert not ok
    assert detail == "delete_window_expired"