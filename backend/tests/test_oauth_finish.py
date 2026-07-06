"""OAuth finish page — installed-client return bridge."""

from __future__ import annotations

from fastapi.testclient import TestClient

from server import create_app

ANDROID_UA = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
)


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
    csp = resp.headers.get("content-security-policy", "")
    assert "script-src 'unsafe-inline'" in csp
    assert "style-src 'unsafe-inline'" in csp


def test_oauth_finish_android_user_agent_renders_button_without_js():
    client = TestClient(create_app())
    resp = client.get(
        "/auth/google?oauth_code=test-code-123",
        headers={"User-Agent": ANDROID_UA},
    )
    assert resp.status_code == 200
    body = resp.text
    assert "Google sign-in complete" in body
    assert 'class="btn"' in body
    assert "intent://auth/google" in body


def test_oauth_finish_api_csp_allows_inline_script():
    client = TestClient(create_app())
    resp = client.get("/api/health")
    assert "script-src 'unsafe-inline'" not in resp.headers.get("content-security-policy", "")


def test_oauth_finish_renders_error():
    client = TestClient(create_app())
    resp = client.get("/auth/google?error=access_denied")
    assert resp.status_code == 200
    assert "access_denied" in resp.text