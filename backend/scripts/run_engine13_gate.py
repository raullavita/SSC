"""Engine 13 gate — complete messenger, no inside AI."""

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


def _file_absent(rel: str) -> dict:
    path = REPO_ROOT / rel
    return {"name": f"absent:{rel}", "passed": not path.is_file(), "detail": "removed"}


def main() -> int:
    sys.path.insert(0, str(BACKEND_ROOT))
    from core.engine13 import engine13_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine13_complete_helper",
            "passed": engine13_complete(),
            "detail": "engine13_complete() is True",
        },
        _file_absent("frontend/src/smart/smartReply.js"),
        _file_absent("frontend/src/smart/useSmartReplies.js"),
    ]

    for rel in [
        "memory/ENGINE13_CHARTER.md",
        "memory/INTELLIGENCE_CHARTER.md",
        "backend/core/engine13.py",
        "backend/core/pqxdh_policy.py",
        "backend/core/reaction_policy.py",
        "frontend/src/signal/safetyNumber.js",
        "frontend/src/chat/reactions.js",
        "scripts/validate_deploy.ps1",
        "backend/scripts/complete_proof.py",
        "backend/tests/test_engine13_complete.py",
        "backend/tests/test_engine13_pqxdh.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "ENGINE13_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "13.10" in charter,
            "detail": "charter documents step 13.10 gate",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_engine13_complete.py",
            "tests/test_engine13_pqxdh.py",
            "tests/test_engine12_smart.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine13_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-800:],
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/complete_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "complete_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 13 GATE PASSED" if passed else "ENGINE 13 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())