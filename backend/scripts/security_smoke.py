"""
Security smoke — Q.56 pre-ZAP gate.

Run against a live SSC API (CI starts uvicorn first):
  python scripts/security_smoke.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from core.security_scan_policy import (  # noqa: E402
    PROTECTED_ROUTE_SAMPLES,
    PUBLIC_SMOKE_PATHS,
    audit_public_payload,
    headers_include_security_baselines,
    is_unauthorized_status,
    response_leaks_secrets,
)

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
TIMEOUT = 15


def _get(path: str) -> requests.Response:
    return requests.get(f"{BASE}{path}", timeout=TIMEOUT)


def check_public_paths() -> None:
    for path in PUBLIC_SMOKE_PATHS:
        r = _get(path)
        assert r.status_code in (200, 503), f"{path} -> {r.status_code}"
        leaks = response_leaks_secrets(r.text)
        assert not leaks, f"{path} leaked: {leaks}"
        missing = headers_include_security_baselines(r.headers)
        assert not missing, f"{path} missing headers: {missing}"


def check_config_surface() -> None:
    r = _get("/api/config")
    assert r.status_code == 200, r.text
    body = r.json()
    leaks = audit_public_payload(body)
    assert not leaks, f"/api/config leaked: {leaks}"
    assert "turnstile_sitekey" in body


def check_protected_routes() -> None:
    for path in PROTECTED_ROUTE_SAMPLES:
        r = _get(path)
        assert is_unauthorized_status(r.status_code), f"{path} -> {r.status_code} (expected 401/403)"


def check_openapi_no_admin_leaks() -> None:
    r = _get("/openapi.json")
    if r.status_code != 200:
        return
    leaks = response_leaks_secrets(r.text)
    assert not leaks, f"openapi.json leaked: {leaks}"


def main() -> int:
    print(f"Security smoke -> {BASE}")
    check_public_paths()
    print("  OK  public paths + headers")
    check_config_surface()
    print("  OK  /api/config surface")
    check_protected_routes()
    print("  OK  protected routes reject anonymous")
    check_openapi_no_admin_leaks()
    print("  OK  openapi.json")
    print("Security smoke PASSED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"Security smoke FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    except requests.RequestException as exc:
        print(f"Security smoke ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc