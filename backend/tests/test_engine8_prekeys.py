"""Prekey bundle API tests — Engine 8."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.1.0/1"}


async def _no_redis():
    return None


@pytest.fixture
async def e8_client(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    monkeypatch.setattr("routers.auth.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.prekeys.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.devices.get_database", lambda: fake_db)
    monkeypatch.setattr("deps.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, fake_db


async def _register(ac):
    return await ac.post(
        "/api/auth/register",
        json={"email": "prekey@example.com", "password": "password123", "display_name": "PK"},
        headers=CLIENT,
    )


@pytest.mark.asyncio
async def test_upload_and_fetch_prekey_bundle(e8_client):
    ac, db = e8_client
    reg = await _register(ac)
    assert reg.status_code == 200

    bundle = {
        "device_id": "dev1",
        "registration_id": 12345,
        "identity_key": "aWRlbnRpdHkta2V5LWhlcmU=",
        "signed_prekey": {
            "key_id": 1,
            "public_key": "c2lnbmVkLXByZWtleS1oZXJl",
            "signature": "c2lnbmF0dXJlLWhlcmU=",
        },
        "prekeys": [{"key_id": 2, "public_key": "cHJla2V5LWhlcmU="}],
    }
    up = await ac.put("/api/prekeys/bundle", json=bundle, headers=CLIENT)
    assert up.status_code == 200
    assert "private_key" not in str(up.json())
    assert len(db["prekeys"].docs) == 1

    user_id = reg.json()["user"]["id"]
    fetch = await ac.get(f"/api/prekeys/users/{user_id}/devices/dev1", headers=CLIENT)
    assert fetch.status_code == 200
    assert fetch.json()["bundle"]["identity_key"] == bundle["identity_key"]