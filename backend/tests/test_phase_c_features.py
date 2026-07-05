"""Phase C + P2#12-14 feature tests."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.push_payload import build_generic_push
from core.ios_shell_policy import step_ios_shell_ready
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
        "routers.friend_requests",
        "routers.reactions",
        "routers.recovery",
        "routers.messages",
        "deps",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


def test_push_payload_includes_kind_metadata():
    payload = build_generic_push({"kind": "poll", "conversation_id": "c_1"})
    assert payload["body"] == "New poll"
    assert payload["data"]["kind"] == "poll"
    assert "ciphertext" not in str(payload).lower()


def test_ios_shell_policy_ready():
    assert step_ios_shell_ready() is True


@pytest.mark.asyncio
async def test_friend_request_accept_creates_conversation(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.friend_requests.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg_a = await client.post(
            "/api/auth/register",
            json={"email": "a@example.com", "password": "password123", "display_name": "A"},
        )
        reg_b = await client.post(
            "/api/auth/register",
            json={"email": "b@example.com", "password": "password123", "display_name": "B"},
        )
        a_id = reg_a.json()["user"]["id"]
        b_id = reg_b.json()["user"]["id"]

        created = await client.post(
            "/api/friend_requests",
            json={"to_user_id": b_id},
            cookies=reg_a.cookies,
        )
        assert created.status_code == 200
        req_id = created.json()["request"]["id"]

        accepted = await client.post(
            f"/api/friend_requests/{req_id}/accept",
            cookies=reg_b.cookies,
        )
        assert accepted.status_code == 200
        assert accepted.json()["conversation_id"]


@pytest.mark.asyncio
async def test_recovery_setup_and_reset(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": "rec@example.com", "password": "password123", "display_name": "Rec"},
        )
        setup = await client.post(
            "/api/auth/recovery/setup",
            json={"recovery_passphrase": "my-secret-recovery-key"},
            cookies=reg.cookies,
        )
        assert setup.status_code == 200

        verify = await client.post(
            "/api/auth/recovery/verify",
            json={"email": "rec@example.com", "recovery_passphrase": "my-secret-recovery-key"},
        )
        assert verify.status_code == 200
        token = verify.json()["recovery_token"]

        reset = await client.post(
            "/api/auth/recovery/reset-password",
            json={"recovery_token": token, "new_password": "newpassword99"},
        )
        assert reset.status_code == 200