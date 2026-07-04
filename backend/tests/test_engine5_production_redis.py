"""Production Redis gate tests — Engine 5."""

from __future__ import annotations

import pytest

from config import Settings
from core.session_production import validate_production_redis


@pytest.mark.asyncio
async def test_production_redis_gate_skipped_in_dev(monkeypatch):
    settings = Settings()
    monkeypatch.setattr(settings, "env", "development")
    await validate_production_redis(settings)


@pytest.mark.asyncio
async def test_production_redis_gate_requires_url(monkeypatch):
    settings = Settings()
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "redis_url", None)
    with pytest.raises(RuntimeError, match="production_requires_redis"):
        await validate_production_redis(settings)


@pytest.mark.asyncio
async def test_production_redis_gate_requires_ping(monkeypatch):
    settings = Settings()
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379")

    async def fake_probe():
        return {"status": "error", "detail": "connection refused"}

    monkeypatch.setattr("core.session_production.probe_redis", fake_probe)
    with pytest.raises(RuntimeError, match="production_redis_unavailable"):
        await validate_production_redis(settings)