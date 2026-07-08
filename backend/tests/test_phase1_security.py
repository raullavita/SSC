"""Phase 1 security hardening — verification tests."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from core.oauth_state import clear_oauth_states_for_tests, consume_oauth_state, store_oauth_state
from core.rate_limit import RateLimiter
from core.startup_gates import validate_production_startup


@pytest.fixture(autouse=True)
def _no_redis_in_phase1_tests(monkeypatch):
    async def _no_redis():
        return None

    monkeypatch.setattr("core.oauth_state.get_redis", _no_redis)
    monkeypatch.setattr("core.rate_limit.get_redis", _no_redis)
    monkeypatch.setattr("db.get_redis", _no_redis)


def _prod_settings(*, jwt_secret: str, cors_origins: list[str]):
    return SimpleNamespace(
        is_production=True,
        jwt_secret=jwt_secret,
        cors_origins=cors_origins,
    )


@pytest.mark.asyncio
async def test_oauth_state_single_use():
    clear_oauth_states_for_tests()
    await store_oauth_state("state-abc-123")
    assert await consume_oauth_state("state-abc-123") == "web"
    assert await consume_oauth_state("state-abc-123") is None


@pytest.mark.asyncio
async def test_oauth_state_rejects_missing():
    clear_oauth_states_for_tests()
    assert await consume_oauth_state(None) is None
    assert await consume_oauth_state("") is None


@pytest.mark.asyncio
async def test_rate_limiter_memory_allows_under_limit():
    limiter = RateLimiter("test", 3, 60)
    assert await limiter.allow("k1") is True
    assert await limiter.allow("k1") is True
    assert await limiter.allow("k1") is True
    assert await limiter.allow("k1") is False


def test_production_startup_rejects_weak_jwt(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    monkeypatch.setenv("MONGO_URL", "mongodb://prod")
    monkeypatch.setenv("REDIS_URL", "redis://prod")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("SSC_SFU_INTERNAL_SECRET", "a" * 32)
    monkeypatch.setenv("CORS_ORIGINS", "https://www.supersecurechat.com")

    settings = _prod_settings(jwt_secret="dev-only-change-me", cors_origins=["https://www.supersecurechat.com"])
    with pytest.raises(RuntimeError, match="production_requires_strong_jwt"):
        validate_production_startup(settings)


def test_production_startup_rejects_weak_sfu(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    monkeypatch.setenv("MONGO_URL", "mongodb://prod")
    monkeypatch.setenv("REDIS_URL", "redis://prod")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("SSC_SFU_INTERNAL_SECRET", "ssc-sfu-dev-secret")
    monkeypatch.setenv("CORS_ORIGINS", "https://www.supersecurechat.com")

    settings = _prod_settings(jwt_secret="x" * 40, cors_origins=["https://www.supersecurechat.com"])
    with pytest.raises(RuntimeError, match="production_requires_strong_sfu"):
        validate_production_startup(settings)


def test_production_startup_rejects_cors_wildcard(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    monkeypatch.setenv("MONGO_URL", "mongodb://prod")
    monkeypatch.setenv("REDIS_URL", "redis://prod")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("SSC_SFU_INTERNAL_SECRET", "y" * 32)
    monkeypatch.setenv("CORS_ORIGINS", "*")

    settings = _prod_settings(jwt_secret="x" * 40, cors_origins=["*"])
    with pytest.raises(RuntimeError, match="production_cors_wildcard"):
        validate_production_startup(settings)


def test_production_startup_passes_with_strong_config(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    monkeypatch.setenv("MONGO_URL", "mongodb://prod")
    monkeypatch.setenv("REDIS_URL", "redis://prod")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("SSC_SFU_INTERNAL_SECRET", "y" * 32)
    monkeypatch.setenv("CORS_ORIGINS", "https://www.supersecurechat.com")

    settings = _prod_settings(jwt_secret="x" * 40, cors_origins=["https://www.supersecurechat.com"])
    validate_production_startup(settings)