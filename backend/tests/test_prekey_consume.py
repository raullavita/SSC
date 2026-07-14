"""Prekey consume-on-fetch tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


@pytest.fixture
async def env(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in (
        "routers.auth",
        "routers.prekeys",
        "routers.devices",
        "routers.conversations",
        "deps",
        "core.token_revocation",
    ):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, fake_db


def _bundle(device_id: str = "1", prekey_count: int = 3) -> dict:
    return {
        "device_id": device_id,
        "registration_id": 12345,
        "identity_key": "aWRlbnRpdHkta2V5LWhlcmU=",
        "signed_prekey": {
            "key_id": 1,
            "public_key": "c2lnbmVkLXByZWtleS1oZXJl",
            "signature": "c2lnbmF0dXJlLWhlcmU=",
        },
        "prekeys": [
            {"key_id": i, "public_key": f"cHJla2V5LWhlcmUtaS5p"}
            for i in range(2, 2 + prekey_count)
        ],
        "kyber_prekey": {
            "key_id": 99,
            "public_key": "a3liZXItcHVibGljLWtleS1oZXJlMTIzNDU2Nzg5MDEyMzQ1Njc4",
            "signature": "a3liZXItc2lnbmF0dXJlLWhlcmU=",
        },
    }


@pytest.mark.asyncio
async def test_fetch_consumes_one_prekey(env):
    ac, db = env
    reg_a = await ac.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "password": "password123", "display_name": "Alice"},
        headers=CLIENT,
    )
    reg_b = await ac.post(
        "/api/auth/register",
        json={"email": "bob@example.com", "password": "password123", "display_name": "Bob"},
        headers=CLIENT,
    )
    alice_id = reg_a.json()["user"]["id"]
    bob_id = reg_b.json()["user"]["id"]

    up = await ac.put("/api/prekeys/bundle", json=_bundle("1", 3), headers=CLIENT, cookies=reg_b.cookies)
    assert up.status_code == 200

    conv = await ac.post(
        "/api/conversations",
        json={"participant_id": bob_id},
        headers=CLIENT,
        cookies=reg_a.cookies,
    )
    assert conv.status_code == 200

    fetch1 = await ac.get(
        f"/api/prekeys/users/{bob_id}/devices/1",
        headers=CLIENT,
        cookies=reg_a.cookies,
    )
    assert fetch1.status_code == 200
    bundle1 = fetch1.json()["bundle"]
    assert len(bundle1.get("prekeys") or []) == 1

    doc_id = f"{bob_id}:1"
    stored = await db["prekeys"].find_one({"_id": doc_id})
    assert len(stored.get("prekeys") or []) == 2

    fetch2 = await ac.get(
        f"/api/prekeys/users/{bob_id}/devices/1",
        headers=CLIENT,
        cookies=reg_a.cookies,
    )
    assert fetch2.status_code == 200
    assert len(fetch2.json()["bundle"].get("prekeys") or []) == 1
    stored2 = await db["prekeys"].find_one({"_id": doc_id})
    assert len(stored2.get("prekeys") or []) == 1