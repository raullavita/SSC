"""Google OAuth helpers — unit tests (no live Google calls)."""

from __future__ import annotations

import pytest

from core.google_oauth import google_idtoken_configured, google_redirect_configured
from core.oauth_exchange import consume_oauth_code, issue_oauth_code


@pytest.mark.asyncio
async def test_oauth_code_roundtrip():
    code = await issue_oauth_code("u_test123")
    assert await consume_oauth_code(code) == "u_test123"
    assert await consume_oauth_code(code) is None


@pytest.mark.asyncio
async def test_oauth_code_reject_empty():
    assert await consume_oauth_code("") is None
    assert await consume_oauth_code("not-a-real-code") is None


def test_google_idtoken_configured_only_needs_client_id(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("GOOGLE_REDIRECT_URI", raising=False)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    assert google_idtoken_configured() is True
    assert google_redirect_configured() is False