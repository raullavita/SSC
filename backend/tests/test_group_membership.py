"""Group leave, remove, dissolve tests."""

from __future__ import annotations

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
    for mod in ("routers.auth", "routers.groups", "deps", "core.token_revocation"):
        monkeypatch.setattr(f"{mod}.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", _no_redis)


@pytest.mark.asyncio
async def test_leave_and_dissolve_group(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
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

        created = await ac.post(
            "/api/groups",
            json={"name": "Team", "member_ids": [b_id]},
            headers=CLIENT,
            cookies=reg_a.cookies,
        )
        assert created.status_code == 200
        group_id = created.json()["group"]["id"]

        leave = await ac.post(
            f"/api/groups/{group_id}/leave",
            headers=CLIENT,
            cookies=reg_b.cookies,
        )
        assert leave.status_code == 200
        assert leave.json()["ok"] is True

        dissolve = await ac.delete(
            f"/api/groups/{group_id}",
            headers=CLIENT,
            cookies=reg_a.cookies,
        )
        assert dissolve.status_code == 200
        assert dissolve.json()["dissolved"] is True