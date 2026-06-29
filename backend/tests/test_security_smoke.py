"""Q.56 — security smoke integration (live API)."""
import os

import pytest
import requests

from core.security_scan_policy import (
    PROTECTED_ROUTE_SAMPLES,
    PUBLIC_SMOKE_PATHS,
    audit_public_payload,
    headers_include_security_baselines,
    is_unauthorized_status,
    response_leaks_secrets,
)

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
TIMEOUT = 15


@pytest.fixture(scope="module")
def api_base():
    try:
        r = requests.get(f"{BASE}/api/health", timeout=5)
        if r.status_code not in (200, 503):
            pytest.skip("API not running")
    except requests.RequestException:
        pytest.skip("API not running")
    return BASE


@pytest.mark.parametrize("path", PUBLIC_SMOKE_PATHS)
def test_public_paths_no_secret_leaks(api_base, path):
    r = requests.get(f"{api_base}{path}", timeout=TIMEOUT)
    assert r.status_code in (200, 503)
    assert not response_leaks_secrets(r.text)


@pytest.mark.parametrize("path", PUBLIC_SMOKE_PATHS)
def test_public_paths_security_headers(api_base, path):
    r = requests.get(f"{api_base}{path}", timeout=TIMEOUT)
    missing = headers_include_security_baselines(r.headers)
    assert not missing, f"{path} missing {missing}"


def test_config_payload_no_secrets(api_base):
    r = requests.get(f"{api_base}/api/config", timeout=TIMEOUT)
    assert r.status_code == 200
    assert not audit_public_payload(r.json())


@pytest.mark.parametrize("path", PROTECTED_ROUTE_SAMPLES)
def test_protected_routes_require_auth(api_base, path):
    r = requests.get(f"{api_base}{path}", timeout=TIMEOUT)
    assert is_unauthorized_status(r.status_code), f"{path} -> {r.status_code}"