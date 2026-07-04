"""Engine 4 gate — metadata minimization."""

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
    from core.engine4 import engine4_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine4_complete_helper",
            "passed": engine4_complete(),
            "detail": "engine4_complete() is True",
        },
    ]

    for rel in [
        "memory/METADATA_MINIMIZATION_CHARTER.md",
        "backend/core/metadata_policy.py",
        "backend/core/last_seen.py",
        "backend/core/push_payload.py",
        "backend/core/conversation_meta.py",
        "backend/push.py",
        "backend/native_push.py",
        "frontend/public/sw.js",
        "frontend/src/lib/presence.js",
        "backend/tests/test_metadata_policy.py",
        "backend/tests/test_last_seen.py",
        "backend/tests/test_push_payload.py",
        "backend/scripts/metadata_proof.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "METADATA_MINIMIZATION_CHARTER.md").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 4.7" in charter.lower() or "4.7" in charter,
            "detail": "charter documents step 4.7 gate",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_metadata_policy.py",
            "tests/test_last_seen.py",
            "tests/test_push_payload.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine4_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-500:],
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/metadata_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "metadata_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else proof.stdout[-300:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 4 GATE PASSED" if passed else "ENGINE 4 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())