"""Public website feedback API."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase


async def _no_redis():
    return None


def _patch(monkeypatch, fake_db):
    monkeypatch.setattr("db.get_database", lambda: fake_db)
    monkeypatch.setattr("db.get_redis", _no_redis)
    monkeypatch.setattr("routers.site_feedback.get_database", lambda: fake_db)


@pytest.mark.asyncio
async def test_submit_and_list_public_feedback(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        post = await client.post(
            "/api/public/feedback",
            json={
                "display_name": "Alex",
                "rating": 5,
                "category": "review",
                "platform": "windows",
                "message": "Installed the Windows app — signup and chat work well.",
            },
        )
        assert post.status_code == 200
        assert post.json()["published"] is True

        listed = await client.get("/api/public/feedback")
        assert listed.status_code == 200
        rows = listed.json()["feedback"]
        assert len(rows) == 1
        assert rows[0]["display_name"] == "Alex"
        assert rows[0]["rating"] == 5
        assert rows[0]["category"] == "review"


@pytest.mark.asyncio
async def test_feedback_works_without_installed_client_header(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/public/feedback")
        assert r.status_code == 200


@pytest.mark.asyncio
async def test_rejects_short_message(monkeypatch):
    fake_db = FakeDatabase()
    _patch(monkeypatch, fake_db)

    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post(
            "/api/public/feedback",
            json={"message": "short"},
        )
        assert r.status_code == 422 or r.status_code == 400