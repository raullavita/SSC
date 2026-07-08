"""Group call mesh signaling — participant fanout and targeted relay."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from core.signal_policy import SIGNAL_PROTOCOL_V1
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


async def _register(transport, email, name):
    async with AsyncClient(transport=transport, base_url="http://test", headers=CLIENT) as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
        )
        assert reg.status_code == 200
        return reg.json(), client.cookies


@pytest.mark.asyncio
async def test_group_call_notifies_all_participants(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.calls.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    alice, cookies = await _register(transport, "gc1@example.com", "Alice")
    bob, _ = await _register(transport, "gc2@example.com", "Bob")
    carol, _ = await _register(transport, "gc3@example.com", "Carol")

    alice_id = alice["user"]["id"]
    bob_id = bob["user"]["id"]
    carol_id = carol["user"]["id"]
    conv_id = "conv_group_1"
    await fake_db.conversations.insert_one(
        {
            "_id": conv_id,
            "type": "group",
            "participants": [alice_id, bob_id, carol_id],
            "created_at": datetime.now(timezone.utc),
        }
    )

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as client:
        resp = await client.post(
            "/api/calls",
            json={"conversation_id": conv_id, "group_call": True, "video": False},
            headers=CLIENT,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["mode"] == "mesh"
        assert body["call"]["group_call"] is True
        assert set(body["call"]["participant_ids"]) == {alice_id, bob_id, carol_id}

    targets = {call.args[0] for call in publish_mock.await_args_list}
    assert f"user:{bob_id}" in targets
    assert f"user:{carol_id}" in targets
    assert f"user:{alice_id}" not in targets


@pytest.mark.asyncio
async def test_group_signal_requires_target_peer(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.calls.ws_hub.publish", publish_mock)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    alice, cookies = await _register(transport, "gs1@example.com", "Alice")
    bob, _ = await _register(transport, "gs2@example.com", "Bob")
    alice_id = alice["user"]["id"]
    bob_id = bob["user"]["id"]

    await fake_db.call_sessions.insert_one(
        {
            "_id": "call_mesh_1",
            "conversation_id": "conv_1",
            "caller_id": alice_id,
            "callee_id": bob_id,
            "group_call": True,
            "participant_ids": [alice_id, bob_id],
            "status": "ringing",
        }
    )

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as client:
        missing = await client.post(
            "/api/calls/signal",
            json={
                "call_id": "call_mesh_1",
                "signal_type": "offer",
                "ciphertext": "encrypted-offer",
                "protocol": SIGNAL_PROTOCOL_V1,
            },
            headers=CLIENT,
        )
        assert missing.status_code == 400
        assert missing.json()["detail"] == "target_peer_required_for_group_call"

        ok = await client.post(
            "/api/calls/signal",
            json={
                "call_id": "call_mesh_1",
                "signal_type": "offer",
                "ciphertext": "encrypted-offer",
                "protocol": SIGNAL_PROTOCOL_V1,
                "target_peer_id": bob_id,
            },
            headers=CLIENT,
        )
        assert ok.status_code == 200

    publish_mock.assert_awaited_once()
    assert publish_mock.await_args.args[0] == f"user:{bob_id}"


@pytest.mark.asyncio
async def test_group_call_end_notifies_all_peers(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)
    publish_mock = AsyncMock()
    monkeypatch.setattr("routers.calls.ws_hub.publish", publish_mock)
    monkeypatch.setattr("routers.calls.delete_sfu_room", AsyncMock())

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    alice, cookies = await _register(transport, "ge1@example.com", "Alice")
    bob, _ = await _register(transport, "ge2@example.com", "Bob")
    carol, _ = await _register(transport, "ge3@example.com", "Carol")
    alice_id = alice["user"]["id"]
    bob_id = bob["user"]["id"]
    carol_id = carol["user"]["id"]

    await fake_db.call_sessions.insert_one(
        {
            "_id": "call_mesh_end",
            "conversation_id": "conv_1",
            "caller_id": alice_id,
            "callee_id": bob_id,
            "group_call": True,
            "participant_ids": [alice_id, bob_id, carol_id],
            "status": "ringing",
        }
    )

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as client:
        end = await client.post(
            "/api/calls/call_mesh_end/end",
            json={"reason": "ended"},
            headers=CLIENT,
        )
        assert end.status_code == 200

    targets = {call.args[0] for call in publish_mock.await_args_list}
    assert targets == {f"user:{bob_id}", f"user:{carol_id}"}