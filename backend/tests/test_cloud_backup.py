"""Encrypted cloud backup API."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from core.cloud_backup_policy import MAX_CLOUD_BACKUP_BYTES, cloud_backup_ready
from server import create_app
from tests.fake_mongo import FakeDatabase
from tests.test_engine3_messaging import CLIENT, _patch_db

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def backup_env(monkeypatch):
    fake_db = FakeDatabase()
    _patch_db(monkeypatch, fake_db)
    monkeypatch.setattr("routers.cloud_backup.get_database", lambda: fake_db)

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


def test_cloud_backup_policy():
    assert cloud_backup_ready() is True
    assert MAX_CLOUD_BACKUP_BYTES >= 1_000_000


async def test_cloud_backup_roundtrip(backup_env):
    _, transport = backup_env
    _, cookies = await _register(transport, "backup@example.com", "Backup User")
    ciphertext = '{"v":1,"ciphertext":"abc"}' * 10

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as client:
        put = await client.put(
            "/api/backup/cloud",
            headers=CLIENT,
            json={"ciphertext": ciphertext},
        )
        assert put.status_code == 200

        got = await client.get("/api/backup/cloud", headers=CLIENT)
        assert got.status_code == 200
        body = got.json()
        assert body["has_backup"] is True
        assert body["backup"]["ciphertext"] == ciphertext

        deleted = await client.delete("/api/backup/cloud", headers=CLIENT)
        assert deleted.status_code == 200

        empty = await client.get("/api/backup/cloud", headers=CLIENT)
        assert empty.json()["has_backup"] is False