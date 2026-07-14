"""Multi-device link tests — Engine 9."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


@pytest.mark.asyncio
async def test_device_link_flow(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    monkeypatch.setattr("routers.auth.get_database", lambda: fake_db)
    monkeypatch.setattr("routers.device_link.get_database", lambda: fake_db)
    monkeypatch.setattr("deps.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        reg = await ac.post(
            "/api/auth/register",
            json={"email": "link@example.com", "password": "password123", "display_name": "Link"},
            headers=CLIENT,
        )
        assert reg.status_code == 200

        link = await ac.post(
            "/api/devices/link",
            json={"device_name": "Phone"},
            headers=CLIENT,
            cookies=reg.cookies,
        )
        assert link.status_code == 200
        token = link.json()["link_token"]

        confirm = await ac.post(
            "/api/devices/link/confirm",
            json={
                "link_token": token,
                "device_id": "2",
                "name": "Phone",
                "platform": "android",
            },
            headers=CLIENT,
        )
        assert confirm.status_code == 200
        assert confirm.json()["device"]["id"] == "2"
        assert len(fake_db["devices"].docs) == 1