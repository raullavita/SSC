"""Health endpoint tests."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_health_returns_status(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body
    assert "mongo" in body
    assert "redis" in body
    assert body["env"] in ("development", "production", "test")


@pytest.mark.asyncio
async def test_root_returns_name(client):
    response = await client.get("/api/")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "SSC - Super Secure Chat"


@pytest.mark.asyncio
async def test_security_headers(client):
    response = await client.get("/api/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"