"""SFU room cleanup on call end — roadmap P1 #8."""

from __future__ import annotations

from unittest.mock import AsyncMock

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
    for mod in ("routers.auth", "routers.sfu", "routers.calls", "deps", "core.token_revocation"):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)
    monkeypatch.setattr("routers.sfu.SFU_ENABLED", True)


@pytest.mark.asyncio
async def test_end_sfu_room_deletes_mediasoup_room(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    delete_mock = AsyncMock(return_value=(True, "deleted"))
    monkeypatch.setattr("routers.sfu.delete_sfu_room", delete_mock)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.sfu.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": "host@example.com", "password": "password123", "display_name": "Host"},
        )
        assert reg.status_code == 200
        host_id = reg.json()["user"]["id"]

        await fake_db.conversations.insert_one(
            {
                "_id": "conv_group",
                "type": "group",
                "participants": [host_id, "peer_2", "peer_3"],
            }
        )
        await fake_db.call_sessions.insert_one(
            {
                "_id": "ssc-room-deadbeef",
                "conversation_id": "conv_group",
                "host_id": host_id,
                "call_type": "sfu",
                "status": "active",
                "sfu_provisioned": True,
            }
        )

        end = await client.post(
            "/api/sfu/rooms/ssc-room-deadbeef/end",
            cookies=reg.cookies,
        )
        assert end.status_code == 200
        body = end.json()
        assert body["ok"] is True
        assert body["sfu_deleted"] is True

    delete_mock.assert_awaited_once_with("ssc-room-deadbeef")
    updated = await fake_db.call_sessions.find_one({"_id": "ssc-room-deadbeef"})
    assert updated["status"] == "ended"
    assert updated["ended_by"] == host_id
    publish_mock.assert_awaited()


@pytest.mark.asyncio
async def test_create_sfu_room_fans_out_credentials(monkeypatch):
    """Host create publishes sfu_room invite to other participants + conversation topic."""
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    provision_mock = AsyncMock(return_value=(True, "provisioned"))
    monkeypatch.setattr("routers.sfu.provision_sfu_room", provision_mock)
    monkeypatch.setattr("routers.sfu.SFU_WS_URL", "wss://sfu.example/ws")
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.sfu.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": "host2@example.com", "password": "password123", "display_name": "Host2"},
        )
        assert reg.status_code == 200
        host_id = reg.json()["user"]["id"]

        await fake_db.conversations.insert_one(
            {
                "_id": "conv_sfu_fanout",
                "type": "group",
                "participants": [host_id, "peer_a", "peer_b"],
            }
        )

        created = await client.post(
            "/api/sfu/rooms",
            json={"conversation_id": "conv_sfu_fanout", "expected_participants": 2},
            cookies=reg.cookies,
        )
        assert created.status_code == 200, created.text
        body = created.json()
        assert body["room_id"]
        assert body["join_token"]
        assert body["ws_url"] == "wss://sfu.example/ws"

    provision_mock.assert_awaited_once()
    topics = [c.args[0] for c in publish_mock.await_args_list]
    assert "user:peer_a" in topics
    assert "user:peer_b" in topics
    assert "conversation:conv_sfu_fanout" in topics
    # Host should not receive a user:host invite
    assert f"user:{host_id}" not in topics
    payloads = [c.args[1] for c in publish_mock.await_args_list]
    assert all(p.get("type") == "sfu_room" for p in payloads)
    assert all(p.get("join_token") == body["join_token"] for p in payloads)


@pytest.mark.asyncio
async def test_call_end_triggers_sfu_delete_for_sfu_session(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    delete_mock = AsyncMock(return_value=(True, "deleted"))
    monkeypatch.setattr("routers.calls.delete_sfu_room", delete_mock)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.calls.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": "caller@example.com", "password": "password123", "display_name": "Caller"},
        )
        caller_id = reg.json()["user"]["id"]

        await fake_db.call_sessions.insert_one(
            {
                "_id": "ssc-room-cafebabe",
                "conversation_id": "c_1",
                "caller_id": caller_id,
                "callee_id": caller_id,
                "call_type": "sfu",
                "sfu_provisioned": True,
                "status": "active",
            }
        )

        end = await client.post(
            "/api/calls/ssc-room-cafebabe/end",
            json={"reason": "ended"},
            cookies=reg.cookies,
        )
        assert end.status_code == 200

    delete_mock.assert_awaited_once_with("ssc-room-cafebabe")