"""Google OAuth helpers — unit tests (no live Google calls)."""

from __future__ import annotations

from core.oauth_exchange import consume_oauth_code, issue_oauth_code


def test_oauth_code_roundtrip():
    code = issue_oauth_code("u_test123")
    assert consume_oauth_code(code) == "u_test123"
    assert consume_oauth_code(code) is None


def test_oauth_code_reject_empty():
    assert consume_oauth_code("") is None
    assert consume_oauth_code("not-a-real-code") is None