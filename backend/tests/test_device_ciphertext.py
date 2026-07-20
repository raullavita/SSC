"""Per-device ciphertext message tests."""

from __future__ import annotations

import base64
import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}
VALID_CT = base64.b64encode(b"x" * 32).decode("ascii")


async def _no_redis():
    return None


@pytest.fixture
async def env(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.messages",
        "routers.conversations",
        "routers.friend_requests",
        "deps",
        "core.token_revocation",
        "push",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, fake_db


@pytest.mark.asyncio
async def test_send_device_ciphertexts(env):
    ac, _db = env
    reg_a = await ac.post(
        "/api/auth/register",
        json={"email": "a@example.com", "password": "password123", "display_name": "A"},
        headers=CLIENT,
    )
    reg_b = await ac.post(
        "/api/auth/register",
        json={"email": "b@example.com", "password": "password123", "display_name": "B"},
        headers=CLIENT,
    )
    b_id = reg_b.json()["user"]["id"]

    fr = await ac.post(
        "/api/friend_requests",
        json={"to_user_id": b_id},
        headers=CLIENT,
        cookies=reg_a.cookies,
    )
    await ac.post(
        f"/api/friend_requests/{fr.json()['request']['id']}/accept",
        headers=CLIENT,
        cookies=reg_b.cookies,
    )

    conv = await ac.post(
        "/api/conversations",
        json={"participant_id": b_id},
        headers=CLIENT,
        cookies=reg_a.cookies,
    )
    conv_id = conv.json()["conversation"]["id"]

    send = await ac.post(
        f"/api/conversations/{conv_id}/messages",
        json={
            "device_ciphertexts": {"1": VALID_CT, "2": VALID_CT},
            "protocol": "signal_v1",
        },
        headers=CLIENT,
        cookies=reg_a.cookies,
    )
    assert send.status_code == 200
    msg = send.json()["message"]
    assert msg["ciphertext"] == VALID_CT

    listed = await ac.get(
        f"/api/conversations/{conv_id}/messages",
        headers={**CLIENT, "X-SSC-Device-Id": "2"},
        cookies=reg_b.cookies,
    )
    assert listed.status_code == 200
    items = listed.json()["messages"]
    assert items[0]["ciphertext"] == VALID_CT
    assert items[0].get("target_device_id") == "2"


@pytest.mark.asyncio
async def test_fanout_redacts_device_map_on_conversation_topic(env, monkeypatch):
    from core.message_fanout import fanout_message

    published: list[tuple[str, dict]] = []

    async def fake_publish(topic: str, payload: dict) -> None:
        published.append((topic, payload))

    monkeypatch.setattr("core.message_fanout.ws_hub.publish", fake_publish)

    async def fake_device_ids(_db, _uid):
        return ["1", "2"]

    monkeypatch.setattr("core.message_fanout.participant_device_ids", fake_device_ids)

    doc = {
        "_id": "m_2",
        "conversation_id": "c_2",
        "sender_id": "u_a",
        "ciphertext": VALID_CT,
        "device_ciphertexts": {"1": VALID_CT, "2": VALID_CT},
        "protocol": "signal_v1",
        "created_at": None,
    }
    await fanout_message("c_2", doc, ["u_a", "u_b"], "u_a")

    conv = next(p for topic, p in published if topic == "conversation:c_2")
    assert "device_ciphertexts" not in conv.get("message", {})

    user_b = next(p for topic, p in published if topic == "user:u_b")
    msg = user_b.get("message", {})
    if "device_ciphertexts" in msg:
        assert set(msg["device_ciphertexts"].keys()).issubset({"1", "2"})