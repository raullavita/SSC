#!/usr/bin/env python3
"""Q.64 / TASK J — release-candidate preflight before founder device matrix."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from core.device_matrix_policy import (  # noqa: E402
    DEFAULT_API_URL,
    MATRIX_ROWS,
    validate_matrix_artifacts,
)

API_BASE = (
    os.environ.get("SSC_API_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or DEFAULT_API_URL
).rstrip("/")


def _get(path: str) -> tuple[int, dict | str]:
    url = f"{API_BASE}{path}"
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, raw
    except Exception as exc:
        return 0, str(exc)


def main() -> int:
    print(f"Q.64 device matrix preflight — {API_BASE}")
    failures: list[str] = []

    missing = validate_matrix_artifacts()
    if missing:
        failures.append(f"missing artifacts: {missing}")
    else:
        print("OK  matrix repo artifacts present")

    status, health = _get("/api/health")
    if status != 200:
        failures.append(f"/api/health -> {status} ({health})")
    else:
        print("OK  /api/health")

    status, cfg = _get("/api/config")
    if status != 200 or not isinstance(cfg, dict):
        failures.append(f"/api/config -> {status}")
    else:
        installed = cfg.get("installed_client") or {}
        if installed.get("browser_product_surface_allowed") is not False:
            failures.append("installed_client.browser_product_surface_allowed must be false")
        updates = cfg.get("client_updates") or {}
        if not (updates.get("latest_version") or "").strip():
            failures.append("client_updates.latest_version missing")
        matrix = cfg.get("device_matrix") or {}
        if matrix.get("matrix_id") != "Q.64":
            failures.append("device_matrix block missing or wrong matrix_id")
        if len(matrix.get("matrix_rows") or []) != len(MATRIX_ROWS):
            failures.append("device_matrix.matrix_rows count mismatch")
        if not failures:
            print("OK  /api/config (installed_client + client_updates + device_matrix)")
            print(json.dumps({
                "latest_version": updates.get("latest_version"),
                "primary_devices": matrix.get("primary_devices"),
                "matrix_rows": len(matrix.get("matrix_rows") or []),
                "turn_configured": (cfg.get("calls") or {}).get("turn_configured"),
            }, indent=2))

    if failures:
        print("FAIL:")
        for item in failures:
            print(f"  - {item}")
        print("See scripts/DEVICE_MATRIX_SETUP.txt")
        return 1

    print("OK: preflight passed — run founder matrix in test_reports/Q64_DEVICE_MATRIX.md")
    print("  .\\scripts\\run_device_matrix.ps1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())