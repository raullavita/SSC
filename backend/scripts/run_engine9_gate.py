"""Engine 9 gate — multi-device, sealed sender, groups, SFU."""

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
    from core.engine9 import engine9_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine9_complete_helper",
            "passed": engine9_complete(),
            "detail": "engine9_complete() is True",
        },
    ]

    for rel in [
        "memory/ENGINE9_CHARTER.md",
        "memory/SFU_CHARTER.md",
        "backend/core/multi_device_policy.py",
        "backend/core/sealed_sender_policy.py",
        "backend/core/group_policy.py",
        "backend/core/sfu_policy.py",
        "backend/core/message_fanout.py",
        "backend/core/engine9.py",
        "backend/routers/device_link.py",
        "backend/routers/groups.py",
        "backend/routers/sfu.py",
        "frontend/src/signal/sealedSender.js",
        "frontend/src/devices/useMultiDevice.js",
        "frontend/src/chat/useGroupChat.js",
        "frontend/src/calls/useGroupCall.js",
        "frontend/src/calls/sfuClient.js",
        "backend/tests/test_sealed_sender.py",
        "backend/tests/test_engine9_groups.py",
        "backend/tests/test_engine9_device_link.py",
        "backend/tests/test_engine9_sfu.py",
        "backend/scripts/advanced_proof.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "ENGINE9_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 9.12" in charter.lower() or "9.12" in charter,
            "detail": "charter documents step 9.12 gate",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_sealed_sender.py",
            "tests/test_engine9_groups.py",
            "tests/test_engine9_device_link.py",
            "tests/test_engine9_sfu.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine9_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-800:],
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/advanced_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "advanced_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 9 GATE PASSED" if passed else "ENGINE 9 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())