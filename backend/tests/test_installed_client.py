"""Installed-client enforcement tests — Engine 2."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from core.installed_client_policy import (
    parse_client_header,
    validate_request,
)
from server import create_app

VALID_HEADER = "android/0.3.1/10"
NATIVE_BRIDGE_HEADER = {"X-SSC-Native-Bridge": "v1"}


def test_parse_valid_header():
    identity = parse_client_header("windows/1.0.27/80")
    assert identity is not None
    assert identity.platform == "windows"
    assert identity.version == "1.0.27"
    assert identity.build == "80"


@pytest.mark.parametrize(
    "value",
    ["", "browser/1.0.0", "android/1.0", "invalid", "web/0.1.0/1"],
)
def test_parse_rejects_invalid_header(value: str):
    assert parse_client_header(value) is None


def test_health_path_exempt():
    ok, _ = validate_request("/api/health", None)
    assert ok is True


def test_config_requires_header():
    ok, detail = validate_request("/api/config", None)
    assert ok is False
    assert "installed_client_required" in detail


@pytest.fixture
async def enforced_client():
    app = create_app()
    app.state.enforce_installed_client = True
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_works_without_header(enforced_client):
    response = await enforced_client.get("/api/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_config_blocked_without_header(enforced_client):
    response = await enforced_client.get("/api/config")
    assert response.status_code == 403
    assert "installed_client_required" in response.json()["detail"]


@pytest.mark.asyncio
async def test_config_allowed_with_header(enforced_client):
    response = await enforced_client.get(
        "/api/config",
        headers={"X-SSC-Client": VALID_HEADER, **NATIVE_BRIDGE_HEADER},
    )
    assert response.status_code == 200
    assert response.json()["installed_client_required"] is True


def test_native_bridge_required_in_production(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    monkeypatch.setenv("SSC_REQUIRE_NATIVE_BRIDGE", "true")
    ok, detail = validate_request("/api/config", VALID_HEADER, native_bridge=None)
    assert ok is False
    assert detail == "native_bridge_required"
    ok2, _ = validate_request("/api/config", VALID_HEADER, native_bridge="v1")
    assert ok2 is True


def test_outdated_client_rejected():
    ok, detail = validate_request("/api/config", "android/0.1.0/1", native_bridge="v1")
    assert ok is False
    assert detail == "installed_client_outdated"


@pytest.mark.asyncio
async def test_root_api_blocked_without_header(enforced_client):
    response = await enforced_client.get("/api/")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_panic_wipe_blocked_without_client_header(enforced_client):
    response = await enforced_client.post(
        "/api/panic/wipe",
        headers={"X-SSC-User-Id": "user-1"},
    )
    assert response.status_code == 403