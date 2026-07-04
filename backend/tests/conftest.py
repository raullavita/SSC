"""Pytest fixtures."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from server import create_app

CLIENT_HEADERS = {"X-SSC-Client": "electron/0.1.0/1"}


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