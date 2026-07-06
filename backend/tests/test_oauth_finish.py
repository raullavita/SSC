"""OAuth finish page — installed-client return bridge."""

from __future__ import annotations

from fastapi.testclient import TestClient

from server import create_app


def test_oauth_finish_renders_bridge_page():
    client = TestClient(create_app())
    resp = client.get("/auth/google?oauth_code=test-code-123")
    assert resp.status_code == 200
    body = resp.text
    assert "ssc://auth/google" in body
    assert "test-code-123" in body
    assert "intent://auth/google" in body
    assert "com.supersecurechat.app" in body
    assert "browser_fallback_url" not in body
    assert "Open Super Secure Chat" in body


def test_oauth_finish_renders_error():
    client = TestClient(create_app())
    resp = client.get("/auth/google?error=access_denied")
    assert resp.status_code == 200
    assert "access_denied" in resp.text