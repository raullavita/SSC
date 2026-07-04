"""Step 7 — stories, polls, disappearing messages."""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from core.session_policy import SESSION_COOKIE_NAME
from core.story_policy import engine7_stories_ready, public_story
from core.poll_policy import engine7_polls_ready, public_poll, validate_option_count
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}
VALID_B64 = base64.b64encode(b"hello step 7 poll story").decode()


async def _no_redis():
    return None


def _patch_db(monkeypatch, fake_db: FakeDatabase) -> None:
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.conversations",
        "routers.messages",
        "routers.stories",
        "routers.polls",
        "deps",
        "push",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


@pytest.fixture
async def step7_env(monkeypatch):
    fake_db = FakeDatabase()
    _patch_db(monkeypatch, fake_db)
    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    yield fake_db, transport


async def _register(transport, email: str, name: str):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        assert response.status_code == 200
        return response.json(), client.cookies


def test_step7_policy_helpers():
    assert engine7_stories_ready() is True
    assert engine7_polls_ready() is True
    assert validate_option_count(2)[0] is True
    assert validate_option_count(1)[0] is False


def test_public_story_scrubs_forbidden():
    doc = {
        "_id": "story_1",
        "user_id": "u_a",
        "ciphertext": VALID_B64,
        "protocol": "signal_v1_story",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc),
        "email": "leak@test.com",
    }
    out = public_story(doc)
    assert "email" not in out
    assert out["id"] == "story_1"


def test_public_poll_shape():
    doc = {
        "_id": "poll_1",
        "conversation_id": "c_1",
        "message_id": "m_1",
        "creator_id": "u_a",
        "ciphertext": VALID_B64,
        "protocol": "signal_v1_poll",
        "option_count": 3,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc),
    }
    out = public_poll(doc)
    assert out["option_count"] == 3
    assert "participants" not in out


@pytest.mark.asyncio
async def test_story_feed_and_create(step7_env):
    fake_db, transport = step7_env
    alice, alice_cookies = await _register(transport, "alice7@example.com", "Alice")
    bob, bob_cookies = await _register(transport, "bob7@example.com", "Bob")

    conv_id = "c_step7"
    await fake_db.conversations.insert_one(
        {
            "_id": conv_id,
            "type": "direct",
            "participants": [alice["user"]["id"], bob["user"]["id"]],
            "updated_at": datetime.now(timezone.utc),
        }
    )

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        created = await ac.post(
            "/api/stories",
            json={"ciphertext": VALID_B64, "protocol": "signal_v1_story"},
            headers=CLIENT,
        )
        assert created.status_code == 200
        assert created.json()["story"]["user_id"] == alice["user"]["id"]

    async with AsyncClient(transport=transport, base_url="http://test", cookies=bob_cookies) as bc:
        feed = await bc.get("/api/stories/feed", headers=CLIENT)
        assert feed.status_code == 200
        assert len(feed.json()["stories"]) >= 1


@pytest.mark.asyncio
async def test_poll_create_and_vote(step7_env):
    fake_db, transport = step7_env
    alice, alice_cookies = await _register(transport, "alice7p@example.com", "Alice")
    bob, bob_cookies = await _register(transport, "bob7p@example.com", "Bob")
    conv_id = "c_poll7"
    await fake_db.conversations.insert_one(
        {
            "_id": conv_id,
            "type": "direct",
            "participants": [alice["user"]["id"], bob["user"]["id"]],
            "updated_at": datetime.now(timezone.utc),
        }
    )

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        created = await ac.post(
            f"/api/conversations/{conv_id}/polls",
            json={
                "ciphertext": VALID_B64,
                "protocol": "signal_v1_poll",
                "option_count": 2,
            },
            headers=CLIENT,
        )
        assert created.status_code == 200
        poll_id = created.json()["poll"]["id"]
        assert created.json()["message"]["message_kind"] == "poll"

    async with AsyncClient(transport=transport, base_url="http://test", cookies=bob_cookies) as bc:
        vote = await bc.post(
            f"/api/conversations/{conv_id}/polls/{poll_id}/votes",
            json={
                "option_index": 1,
                "ciphertext": VALID_B64,
                "protocol": "signal_v1_poll",
            },
            headers=CLIENT,
        )
        assert vote.status_code == 200
        assert vote.json()["viewer_vote"] == 1
        assert vote.json()["tallies"]["1"] == 1


@pytest.mark.asyncio
async def test_expired_messages_filtered(step7_env):
    fake_db, transport = step7_env
    alice, alice_cookies = await _register(transport, "alice7e@example.com", "Alice")
    conv_id = "c_exp7"
    await fake_db.conversations.insert_one(
        {
            "_id": conv_id,
            "type": "direct",
            "participants": [alice["user"]["id"], "u_other"],
            "updated_at": datetime.now(timezone.utc),
        }
    )
    await fake_db.messages.insert_one(
        {
            "_id": "m_live",
            "conversation_id": conv_id,
            "sender_id": alice["user"]["id"],
            "ciphertext": VALID_B64,
            "protocol": "signal_v1",
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        }
    )
    await fake_db.messages.insert_one(
        {
            "_id": "m_dead",
            "conversation_id": conv_id,
            "sender_id": alice["user"]["id"],
            "ciphertext": VALID_B64,
            "protocol": "signal_v1",
            "created_at": datetime.now(timezone.utc) - timedelta(hours=2),
            "expires_at": datetime.now(timezone.utc) - timedelta(seconds=1),
        }
    )

    async with AsyncClient(transport=transport, base_url="http://test", cookies=alice_cookies) as ac:
        listed = await ac.get(f"/api/conversations/{conv_id}/messages", headers=CLIENT)
        assert listed.status_code == 200
        ids = {m["id"] for m in listed.json()["messages"]}
        assert "m_live" in ids
        assert "m_dead" not in ids