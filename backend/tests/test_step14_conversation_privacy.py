"""Step 14 — per-chat privacy controls."""

from __future__ import annotations

import base64
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.conversation_privacy_policy import (
    effective_last_seen_visible,
    effective_read_receipts,
    effective_typing_visible,
    step14_conversation_privacy_ready,
)
from core.signal_policy import SIGNAL_PROTOCOL_V1
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.conversations",
        "routers.messages",
        "routers.typing",
        "routers.presence",
        "deps",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


def test_effective_privacy_overrides():
    global_settings = {"read_receipts": False, "last_seen_visible": False}
    meta = {"privacy_read_receipts": True, "privacy_typing_visible": False}
    assert effective_read_receipts(global_settings, meta) is True
    assert effective_typing_visible(global_settings, meta) is False
    assert effective_last_seen_visible(global_settings, meta) is False
    assert step14_conversation_privacy_ready()


@pytest.mark.asyncio
async def test_patch_conversation_privacy_returns_overrides(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "priv_a@example.com", "password": "password123", "display_name": "PrivA"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "priv_b@example.com", "password": "password123", "display_name": "PrivB"},
        )
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        patch = await client.patch(
            f"/api/conversations/{conv_id}/privacy",
            json={
                "read_receipts": True,
                "typing_visible": False,
                "disappearing_seconds_default": 3600,
            },
            cookies=reg_a.cookies,
        )
        assert patch.status_code == 200
        privacy = patch.json()["conversation"]["privacy"]
        assert privacy["read_receipts"] is True
        assert privacy["typing_visible"] is False
        assert privacy["disappearing_seconds_default"] == 3600


@pytest.mark.asyncio
async def test_typing_suppressed_when_chat_override_off(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.typing.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "type_a@example.com", "password": "password123", "display_name": "TypeA"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "type_b@example.com", "password": "password123", "display_name": "TypeB"},
        )
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        await client.patch(
            f"/api/conversations/{conv_id}/privacy",
            json={"typing_visible": False},
            cookies=reg_a.cookies,
        )

        typing = await client.post(
            f"/api/conversations/{conv_id}/typing",
            json={"active": True},
            cookies=reg_a.cookies,
        )
        assert typing.status_code == 200
        assert typing.json().get("suppressed") is True
        publish_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_read_receipts_use_per_chat_override(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("core.read_receipts.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "read_a@example.com", "password": "password123", "display_name": "ReadA"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "read_b@example.com", "password": "password123", "display_name": "ReadB"},
        )
        alice_id = reg_a.json()["user"]["id"]
        bob_id = reg_b.json()["user"]["id"]

        conv = await client.post(
            "/api/conversations",
            json={"participant_id": bob_id},
            cookies=reg_a.cookies,
        )
        conv_id = conv.json()["conversation"]["id"]

        ciphertext = base64.b64encode(b"x" * 32).decode()
        send = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"ciphertext": ciphertext, "protocol": SIGNAL_PROTOCOL_V1},
            cookies=reg_a.cookies,
        )
        msg_id = send.json()["message"]["id"]

        await client.patch(
            f"/api/conversations/{conv_id}/privacy",
            json={"read_receipts": True},
            cookies=reg_b.cookies,
        )

        read = await client.post(
            f"/api/conversations/{conv_id}/read",
            json={"last_message_id": msg_id},
            cookies=reg_b.cookies,
        )
        assert read.status_code == 200
        assert read.json()["receipt_sent"] is True
        publish_mock.assert_awaited()
        _ = alice_id