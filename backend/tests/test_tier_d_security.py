"""Tier D security tests — prekey relationship, abuse pipeline, new-account cooldown."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from core.abuse_enforcement import is_abuse_rate_limited, process_abuse_report
from core.new_account_policy import is_new_account
from core.prekey_policy import prekey_fetch_allowed
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/8"}


async def _no_redis():
    return None


@pytest.fixture
async def td_env(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.prekeys",
        "routers.abuse",
        "routers.conversations",
        "deps",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    yield transport, fake_db


async def _register(transport, email: str, name: str):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        return response.json(), client.cookies


@pytest.mark.asyncio
async def test_prekey_fetch_denied_without_relationship(td_env):
    transport, db = td_env
    alice, alice_cookies = await _register(transport, "alice@example.com", "Alice")
    bob, _bob_cookies = await _register(transport, "bob@example.com", "Bob")
    alice_id = alice["user"]["id"]
    bob_id = bob["user"]["id"]

    assert await prekey_fetch_allowed(db, alice_id, bob_id) is False

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        fetch = await ac.get(f"/api/prekeys/users/{bob_id}/devices/dev1", headers=CLIENT)
    assert fetch.status_code == 403
    assert fetch.json()["detail"] == "prekey_fetch_not_allowed"


@pytest.mark.asyncio
async def test_prekey_fetch_allowed_for_group_members(td_env):
    transport, db = td_env
    reg_a, _ = await _register(transport, "ga@example.com", "GA")
    reg_b, _ = await _register(transport, "gb@example.com", "GB")
    alice_id = reg_a["user"]["id"]
    bob_id = reg_b["user"]["id"]
    await db.groups.insert_one(
        {"_id": "g_test", "member_ids": [alice_id, bob_id], "owner_id": alice_id, "name": "G"}
    )
    assert await prekey_fetch_allowed(db, alice_id, bob_id) is True


@pytest.mark.asyncio
async def test_prekey_fetch_allowed_for_direct_conversation(td_env):
    transport, db = td_env
    alice, _alice_cookies = await _register(transport, "alice2@example.com", "Alice")
    bob, _bob_cookies = await _register(transport, "bob2@example.com", "Bob")
    alice_id = alice["user"]["id"]
    bob_id = bob["user"]["id"]

    now = datetime.now(timezone.utc)
    await db.conversations.insert_one(
        {
            "_id": "c_test",
            "type": "direct",
            "participants": [alice_id, bob_id],
            "created_at": now,
            "updated_at": now,
        }
    )
    assert await prekey_fetch_allowed(db, alice_id, bob_id) is True


@pytest.mark.asyncio
async def test_abuse_report_pipeline_rate_limits_target(td_env):
    _transport, db = td_env

    target_body, _ = await _register(_transport, "bad@example.com", "Bad")
    target_id = target_body["user"]["id"]

    for i in range(3):
        other_body, _ = await _register(_transport, f"other{i}@example.com", f"O{i}")
        result = await process_abuse_report(
            db,
            reporter_id=other_body["user"]["id"],
            target_user_id=target_id,
            conversation_id=None,
            reason="spam",
            spam_score=2,
            also_block=False,
        )
        if i == 2:
            assert result["rate_limited"] is True

    assert await is_abuse_rate_limited(db, target_id) is True


def test_new_account_detection():
    now = datetime.now(timezone.utc)
    user = {"created_at": now - timedelta(hours=2)}
    assert is_new_account(user, now) is True
    old = {"created_at": now - timedelta(hours=48)}
    assert is_new_account(old, now) is False