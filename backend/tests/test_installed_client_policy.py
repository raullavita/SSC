"""Installed-client-only API policy tests."""
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from core.installed_client_policy import (
    BROWSER_PRODUCT_SURFACE_ALLOWED,
    enforce_installed_client_api,
    path_allows_browser_api,
    should_block_browser_api_request,
)

REPO = Path(__file__).resolve().parents[2]


def _request(path: str, *, installed: bool = False, method: str = "GET"):
    req = MagicMock()
    req.method = method
    req.url.path = path
    req.headers = {"x-ssc-client": "installed"} if installed else {}
    return req


def test_browser_product_surface_disallowed():
    assert BROWSER_PRODUCT_SURFACE_ALLOWED is False


def test_public_paths_allow_browser():
    for path in ("/api/health", "/api/config", "/api/status", "/api"):
        assert path_allows_browser_api(path) is True


def test_auth_path_blocks_browser():
    req = _request("/api/auth/login")
    assert should_block_browser_api_request(req) is True


def test_messages_path_blocks_browser():
    req = _request("/api/messages/send")
    assert should_block_browser_api_request(req) is True


def test_installed_header_allows_product_api():
    req = _request("/api/messages/send", installed=True)
    assert should_block_browser_api_request(req) is False


def test_enforce_raises_for_browser_product_api():
    with pytest.raises(HTTPException) as exc:
        enforce_installed_client_api(_request("/api/users/me"))
    assert exc.value.status_code == 403
    assert "installed_client_required" in str(exc.value.detail)


def test_middleware_registered():
    text = (REPO / "backend" / "middleware.py").read_text(encoding="utf-8")
    assert "installed_client_only_api" in text


def test_verify_email_gated_in_app():
    app = (REPO / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    assert 'path="/verify-email"' in app
    assert "InstalledClientGate" in app
    assert "VerifyEmail" in app