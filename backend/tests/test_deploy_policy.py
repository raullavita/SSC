"""Deploy policy tests — Engine 10."""

from __future__ import annotations

from core.deploy_policy import (
    CLOUD_RUN_SERVICE,
    PRODUCTION_API_HOST,
    engine10_deploy_policy_ready,
    production_env_valid,
)


def test_production_env_valid_when_complete():
    env = {
        "MONGO_URL": "mongodb://localhost",
        "JWT_SECRET": "super-secret-production-key-32chars",
        "REDIS_URL": "redis://localhost:6379",
        "SSC_ENV": "production",
    }
    ok, missing = production_env_valid(env)
    assert ok is True
    assert missing == []


def test_production_env_rejects_dev_jwt():
    env = {
        "MONGO_URL": "mongodb://localhost",
        "JWT_SECRET": "dev-only-change-me",
        "REDIS_URL": "redis://localhost:6379",
        "SSC_ENV": "production",
    }
    ok, missing = production_env_valid(env)
    assert ok is False
    assert any("JWT_SECRET" in m for m in missing)


def test_deploy_policy_constants(monkeypatch):
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost")
    monkeypatch.setenv("JWT_SECRET", "super-secret-production-key-32chars")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    monkeypatch.setenv("SSC_ENV", "production")
    assert PRODUCTION_API_HOST == "api.supersecurechat.com"
    assert CLOUD_RUN_SERVICE == "ssc-api"
    assert engine10_deploy_policy_ready() is True