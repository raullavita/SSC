"""Engine 12 gate — premium UX features."""

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
    from core.engine12 import engine12_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine12_complete_helper",
            "passed": engine12_complete(),
            "detail": "engine12_complete() is True",
        },
        _file_absent("frontend/src/smart/smartReply.js"),
        _file_absent("frontend/src/smart/useSmartReplies.js"),
    ]

    for rel in [
        "memory/INTELLIGENCE_CHARTER.md",
        "backend/core/feature_policy.py",
        "backend/core/engine12.py",
        "backend/routers/typing.py",
        "frontend/src/search/messageIndex.js",
        "frontend/src/lib/languageDetect.js",
        "frontend/src/chat/useTypingIndicator.js",
        "frontend/src/chat/useVoiceMessage.js",
        "frontend/src/hooks/usePresenceMap.js",
        "backend/tests/test_engine12_smart.py",
        "backend/scripts/smart_proof.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "INTELLIGENCE_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 12.12" in charter.lower() or "12.12" in charter,
            "detail": "charter documents step 12.12 gate",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_engine12_smart.py",
            "tests/test_metadata_policy.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine12_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-800:],
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/smart_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "smart_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE12 GATE PASSED" if passed else "ENGINE12 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())