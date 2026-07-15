"""Bidirectional block enforcement on contact surfaces."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from core.abuse_enforcement import record_user_block
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
        "routers.abuse",
        "routers.friend_requests",
        "routers.prekeys",
        "routers.calls",
        "routers.conversations",
        "deps",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


async def _register(transport, email: str, name: str):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        return response.json(), client.cookies


@pytest.mark.asyncio
async def test_friend_request_blocked_by_recipient(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    reg_a, cookies_a = await _register(transport, "a@example.com", "A")
    reg_b, _ = await _register(transport, "b@example.com", "B")
    a_id = reg_a["user"]["id"]
    b_id = reg_b["user"]["id"]
    await record_user_block(fake_db, b_id, a_id)

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies_a) as ac:
        created = await ac.post(
            "/api/friend_requests",
            json={"to_user_id": b_id},
            headers=CLIENT,
        )
        assert created.status_code == 403
        assert created.json()["detail"] == "blocked_by_recipient"


@pytest.mark.asyncio
async def test_prekey_fetch_blocked_when_viewer_blocked_target(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    reg_a, cookies_a = await _register(transport, "a@example.com", "A")
    reg_b, _ = await _register(transport, "b@example.com", "B")
    a_id = reg_a["user"]["id"]
    b_id = reg_b["user"]["id"]
    now = datetime.now(timezone.utc)
    await fake_db.conversations.insert_one(
        {
            "_id": "c_block",
            "type": "direct",
            "participants": [a_id, b_id],
            "created_at": now,
            "updated_at": now,
        }
    )
    await fake_db.prekeys.insert_one(
        {
            "_id": f"{b_id}:1",
            "user_id": b_id,
            "device_id": "1",
            "registration_id": 1,
            "identity_key": "aWQx",
            "signed_prekey": {"key_id": 1, "public_key": "c3Br", "signature": "c2ln"},
            "prekeys": [{"key_id": 1, "public_key": "b3Br"}],
        }
    )
    await record_user_block(fake_db, a_id, b_id)

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies_a) as ac:
        fetch = await ac.get(f"/api/prekeys/users/{b_id}/devices/1", headers=CLIENT)
        assert fetch.status_code == 403
        assert fetch.json()["detail"] == "you_blocked_user"