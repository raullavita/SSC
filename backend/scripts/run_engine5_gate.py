"""Engine 5 gate — session hardening."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def _check_file(rel: str) -> dict:
    path = REPO_ROOT / rel
    return {"name": f"file:{rel}", "passed": path.is_file(), "detail": "" if path.is_file() else "missing"}


def main() -> int:
    sys.path.insert(0, str(BACKEND_ROOT))
    from core.engine5 import engine5_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine5_complete_helper",
            "passed": engine5_complete(),
            "detail": "engine5_complete() is True",
        },
    ]

    for rel in [
        "memory/SESSION_HARDENING_CHARTER.md",
        "backend/core/session_ttl.py",
        "backend/core/session_policy.py",
        "backend/core/session_cookie.py",
        "backend/core/session_issue.py",
        "backend/core/token_revocation.py",
        "backend/core/session_production.py",
        "frontend/src/lib/localStorageFootprint.js",
        "frontend/src/lib/clientFootprintOrchestrator.js",
        "backend/tests/test_session_cookie.py",
        "backend/tests/test_session_policy.py",
        "backend/tests/test_engine5_panic_sessions.py",
        "backend/tests/test_engine5_production_redis.py",
        "backend/scripts/session_proof.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "SESSION_HARDENING_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 5.7" in charter.lower() or "5.7" in charter,
            "detail": "charter documents step 5.7 gate",
        }
    )

    api_path = REPO_ROOT / "frontend" / "src" / "lib" / "api.js"
    api_text = api_path.read_text(encoding="utf-8") if api_path.is_file() else ""
    checks.append(
        {
            "name": "web_no_localstorage_jwt",
            "passed": "localStorage" not in api_text and "getAccessToken" not in api_text,
            "detail": "api.js uses cookie credentials only",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_session_cookie.py",
            "tests/test_session_policy.py",
            "tests/test_engine5_panic_sessions.py",
            "tests/test_engine5_production_redis.py",
            "tests/test_engine3_messaging.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine5_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-800:],
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/session_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "session_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 5 GATE PASSED" if passed else "ENGINE 5 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())