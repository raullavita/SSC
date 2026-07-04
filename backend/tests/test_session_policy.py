"""Session policy and TTL tests — Engine 5."""

from __future__ import annotations

import inspect

import pytest

from core import auth_tokens
from core.session_policy import SESSION_COOKIE_NAME, engine5_session_policy_ready
from core.session_ttl import jwt_expiry_delta, session_expires_at, session_ttl_hours
from core.token_revocation import register_session


def test_session_ttl_centralized_in_jwt():
    source = inspect.getsource(auth_tokens.issue_access_token)
    assert "session_expires_at" in source
    assert "session_ttl" in inspect.getsource(auth_tokens)


def test_session_ttl_defaults():
    assert session_ttl_hours() >= 24
    assert jwt_expiry_delta().total_seconds() == session_ttl_hours() * 3600
    assert session_expires_at().tzinfo is not None


def test_session_policy_constants():
    assert SESSION_COOKIE_NAME == "ssc_session"
    assert engine5_session_policy_ready() is True


@pytest.mark.asyncio
async def test_register_session_uses_session_ttl(monkeypatch):
    from tests.fake_mongo import FakeDatabase

    fake_db = FakeDatabase()
    monkeypatch.setattr("core.token_revocation.get_database", lambda: fake_db)
    monkeypatch.setattr("core.token_revocation.get_redis", lambda: _async_none())

    await register_session("user-1", "token-value", "jti-abc")
    doc = await fake_db["sessions"].find_one({"_id": "jti-abc"})
    assert doc is not None
    assert doc["user_id"] == "user-1"
    assert doc["expires_at"] is not None


async def _async_none():
    return None