"""Engine 8 gate — Signal Protocol + comms stack."""

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
    from core.engine8 import engine8_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine8_complete_helper",
            "passed": engine8_complete(),
            "detail": "engine8_complete() is True",
        },
    ]

    for rel in [
        "memory/SIGNAL_CHARTER.md",
        "backend/core/signal_policy.py",
        "backend/core/abuse_policy.py",
        "backend/core/file_policy.py",
        "backend/core/call_policy.py",
        "backend/core/translation_policy.py",
        "backend/core/engine8.py",
        "backend/routers/prekeys.py",
        "backend/routers/devices.py",
        "backend/routers/files.py",
        "backend/routers/calls.py",
        "backend/routers/translation.py",
        "backend/routers/abuse.py",
        "frontend/src/signal/signalBridge.js",
        "frontend/src/signal/envelope.js",
        "frontend/src/chat/useCall.js",
        "frontend/src/chat/useFileTransfer.js",
        "frontend/src/lib/translation.js",
        "electron/preload.js",
        "electron/main.js",
        "backend/tests/test_signal_policy.py",
        "backend/tests/test_engine8_prekeys.py",
        "backend/tests/test_engine8_messages.py",
        "backend/tests/test_engine8_abuse.py",
        "backend/scripts/signal_proof.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "SIGNAL_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 8.12" in charter.lower() or "8.12" in charter,
            "detail": "charter documents step 8.12 gate",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_signal_policy.py",
            "tests/test_engine8_prekeys.py",
            "tests/test_engine8_messages.py",
            "tests/test_engine8_abuse.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine8_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-800:],
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/signal_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "signal_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 8 GATE PASSED" if passed else "ENGINE 8 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())