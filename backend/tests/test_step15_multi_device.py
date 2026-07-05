"""Step 15 — multi-device QR link polish."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from core.multi_device_policy import (
    build_device_link_deep_link,
    build_device_link_path,
    step15_multi_device_polish_ready,
)
from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in ("routers.auth", "routers.device_link", "routers.devices", "deps", "core.token_revocation"):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


def test_link_url_helpers():
    token = "abc123"
    assert "/link-device?token=" in build_device_link_path(token)
    assert build_device_link_deep_link(token).startswith("ssc://link-device?token=")
    assert step15_multi_device_polish_ready()


@pytest.mark.asyncio
async def test_create_link_returns_qr_metadata(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        reg = await ac.post(
            "/api/auth/register",
            json={"email": "qr@example.com", "password": "password123", "display_name": "QR"},
            headers=CLIENT,
        )
        assert reg.status_code == 200

        link = await ac.post(
            "/api/devices/link",
            json={"device_name": "Tablet"},
            headers=CLIENT,
            cookies=reg.cookies,
        )
        assert link.status_code == 200
        body = link.json()
        assert body["link_token"]
        assert body["link_path"].startswith("/link-device?token=")
        assert body["deep_link"].startswith("ssc://link-device?token=")
        assert body["expires_in_seconds"] > 0


@pytest.mark.asyncio
async def test_confirm_link_registers_device(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        reg = await ac.post(
            "/api/auth/register",
            json={"email": "conf@example.com", "password": "password123", "display_name": "Conf"},
            headers=CLIENT,
        )
        link = await ac.post(
            "/api/devices/link",
            json={"device_name": "Phone"},
            headers=CLIENT,
            cookies=reg.cookies,
        )
        token = link.json()["link_token"]

        confirm = await ac.post(
            "/api/devices/link/confirm",
            json={
                "link_token": token,
                "device_id": "dev-tablet",
                "name": "Tablet",
                "platform": "android",
            },
            headers=CLIENT,
        )
        assert confirm.status_code == 200
        assert confirm.json()["device"]["platform"] == "android"
        assert len(fake_db["devices"].docs) == 1