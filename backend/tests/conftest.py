"""Pytest fixtures."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app

CLIENT_HEADERS = {"X-SSC-Client": "electron/0.3.0/3"}


async def _stub_mongo_probe():
    return {"status": "skipped", "detail": "test stub"}


async def _stub_redis_probe():
    return {"status": "skipped", "detail": "test stub"}


async def _no_redis():
    return None


@pytest.fixture(autouse=True)
def isolate_external_services(monkeypatch):
    """Avoid hanging on localhost Mongo/Redis when services are not running."""
    from core.abuse_policy import auth_rate_limiter, feedback_rate_limiter, file_rate_limiter, msg_rate_limiter
    from core.oauth_state import clear_oauth_states_for_tests

    auth_rate_limiter.clear()
    feedback_rate_limiter.clear()
    msg_rate_limiter.clear()
    file_rate_limiter.clear()
    clear_oauth_states_for_tests()

    monkeypatch.setattr("db.probe_mongo", _stub_mongo_probe)
    monkeypatch.setattr("db.probe_redis", _stub_redis_probe)
    monkeypatch.setattr("db.get_redis", _no_redis)
    monkeypatch.setattr("routers.health.probe_mongo", _stub_mongo_probe)
    monkeypatch.setattr("routers.health.probe_redis", _stub_redis_probe)


@pytest.fixture
def app():
    app = create_app()
    app.state.enforce_installed_client = False
    return app


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac