"""Abuse block/unblock/list API tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase

CLIENT = {"X-SSC-Client": "electron/0.3.0/3"}


async def _no_redis():
    return None


async def _register(transport, email: str, name: str):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "display_name": name},
            headers=CLIENT,
        )
        return response.json(), client.cookies


@pytest.mark.asyncio
async def test_block_list_and_unblock(monkeypatch):
    fake_db = FakeDatabase()
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    for mod in ("routers.auth", "routers.abuse", "deps", "core.token_revocation"):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    _reg_a, cookies_a = await _register(transport, "a@example.com", "A")
    reg_b, cookies_b = await _register(transport, "b@example.com", "B")
    a_id = _reg_a["user"]["id"]
    b_id = reg_b["user"]["id"]

    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies_a) as ac_a:
        block = await ac_a.post(
            "/api/abuse/block",
            json={"target_user_id": b_id},
            headers=CLIENT,
        )
        assert block.status_code == 200

        listed = await ac_a.get("/api/abuse/blocks", headers=CLIENT)
        assert listed.status_code == 200
        assert listed.json()["blocks"][0]["blocked_user_id"] == b_id

        async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies_b) as ac_b:
            check = await ac_b.get(f"/api/abuse/blocked-by/{a_id}", headers=CLIENT)
            assert check.status_code == 200
            assert check.json()["blocked"] is True

        unblock = await ac_a.delete(f"/api/abuse/block/{b_id}", headers=CLIENT)
        assert unblock.status_code == 200