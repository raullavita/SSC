"""Database configuration tests."""

from __future__ import annotations

import db
from db import get_mongo_client


def _reset_mongo_client() -> None:
    if db._mongo_client is not None:
        db._mongo_client.close()
        db._mongo_client = None


def test_dev_mongo_client_uses_fast_fail_timeout(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "development")
    monkeypatch.delenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", raising=False)
    _reset_mongo_client()
    db.get_settings.cache_clear()

    client = get_mongo_client()

    assert client.delegate.options.server_selection_timeout == 1
    assert client.delegate.options.pool_options.connect_timeout == 1

    _reset_mongo_client()
    db.get_settings.cache_clear()


def test_production_mongo_client_keeps_longer_timeout(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    monkeypatch.delenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", raising=False)
    _reset_mongo_client()
    db.get_settings.cache_clear()

    client = get_mongo_client()

    assert client.delegate.options.server_selection_timeout == 30
    assert client.delegate.options.pool_options.connect_timeout == 30

    _reset_mongo_client()
    db.get_settings.cache_clear()
