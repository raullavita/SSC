"""Threat-model engine gate — Phase 3 security tests + policy checks."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def _run_pytest(target: str) -> dict:
    result = subprocess.run(
        [sys.executable, "-m", "pytest", target, "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    return {
        "name": f"pytest:{target}",
        "passed": result.returncode == 0,
        "detail": (result.stdout or result.stderr).strip()[-400:],
    }


def _file_exists(rel: str) -> dict:
    path = REPO_ROOT / rel
    return {"name": f"file:{rel}", "passed": path.is_file(), "detail": "" if path.is_file() else "missing"}


def main() -> int:
    checks = [
        _file_exists("backend/core/ws_subscribe_tokens.py"),
        _file_exists("backend/core/password_crypto.py"),
        _file_exists("backend/core/device_attestation.py"),
        _file_exists("backend/core/captcha.py"),
        _file_exists("backend/tests/test_phase3_security.py"),
        _run_pytest("tests/test_phase1_security.py"),
        _run_pytest("tests/test_phase2_security.py"),
        _run_pytest("tests/test_phase3_security.py"),
    ]
    print(json.dumps({"engine": "threat-model", "checks": checks}, indent=2))
    return 0 if all(c["passed"] for c in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())