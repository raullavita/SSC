"""Step 11 — call reliability: end route, missed push, hangup types."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.call_policy import CALL_END_REASONS, CALL_TYPES
from core.push_payload import build_missed_call_push
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in ("routers.auth", "routers.calls", "routers.conversations", "deps", "core.token_revocation"):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


@pytest.mark.asyncio
async def test_end_call_declined_sends_missed_push(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    push_mock = AsyncMock(return_value={"sent": 1})
    monkeypatch.setattr("routers.calls.send_missed_call_push_to_user", push_mock)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.calls.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "caller@example.com", "password": "password123", "display_name": "Caller"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "callee@example.com", "password": "password123", "display_name": "Callee"},
        )
        assert reg_a.status_code == 200
        assert reg_b.status_code == 200
        caller_id = reg_a.json()["user"]["id"]
        callee_id = reg_b.json()["user"]["id"]

        await fake_db.call_sessions.insert_one(
            {
                "_id": "call_test",
                "conversation_id": "c_1",
                "caller_id": caller_id,
                "callee_id": callee_id,
                "status": "ringing",
            }
        )

        end = await client.post(
            "/api/calls/call_test/end",
            json={"reason": "declined"},
            cookies=reg_b.cookies,
        )
        assert end.status_code == 200
        assert end.json()["reason"] == "declined"

    push_mock.assert_awaited()
    args, kwargs = push_mock.await_args
    assert args[0] == caller_id
    publish_mock.assert_awaited()


def test_call_policy_hangup_and_end_reasons():
    assert "hangup" in CALL_TYPES
    assert "declined" in CALL_END_REASONS
    assert "missed" in CALL_END_REASONS


def test_missed_call_push_payload():
    payload = build_missed_call_push({"call_id": "call_x", "conversation_id": "c_1"})
    assert payload["body"] == "Missed call"
    assert payload["data"]["type"] == "missed_call"
    assert "caller" not in payload["body"].lower()


def test_step11_frontend_call_files():
    repo = Path(__file__).resolve().parents[2]
    use_call = (repo / "frontend" / "src" / "chat" / "useCall.js").read_text(encoding="utf-8")
    assert "iceQueueRef" in use_call
    assert "/end" in use_call
    assert "call_ended" in use_call
    modal = (repo / "frontend" / "src" / "components" / "chat" / "CallModal.jsx").read_text(encoding="utf-8")
    assert "STATUS_LABELS" in modal
    media = (repo / "frontend" / "src" / "chat" / "callMedia.js").read_text(encoding="utf-8")
    assert "permission_denied" in media
    manifest = (repo / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(encoding="utf-8")
    assert "RECORD_AUDIO" in manifest
    assert "CAMERA" in manifest