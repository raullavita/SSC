"""Engine 3 gate — messaging scaffold."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def _check_file(rel: str) -> dict:
    path = REPO_ROOT / rel
    exists = path.is_file()
    return {"name": f"file:{rel}", "passed": exists, "detail": "" if exists else "missing"}


def main() -> int:
    sys.path.insert(0, str(BACKEND_ROOT))
    from core.engine3 import engine3_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine3_complete_helper",
            "passed": engine3_complete(),
            "detail": "engine3_complete() is True",
        },
    ]

    for rel in [
        "memory/MESSAGING_CHARTER.md",
        "backend/routers/auth.py",
        "backend/routers/conversations.py",
        "backend/routers/messages.py",
        "backend/routers/ws.py",
        "backend/core/ws_hub.py",
        "frontend/src/chat/useChatSocket.js",
        "frontend/src/chat/useChatMessages.js",
        "frontend/src/pages/ChatHome.jsx",
        "frontend/src/context/AuthContext.jsx",
        "backend/tests/test_engine3_messaging.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "MESSAGING_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 3.7" in charter.lower() or "3.7" in charter,
            "detail": "charter documents step 3.7 gate",
        }
    )

    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_engine3_messaging.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine3_unit_tests",
            "passed": result.returncode == 0,
            "detail": "ok" if result.returncode == 0 else (result.stdout + result.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 3 GATE PASSED" if passed else "ENGINE 3 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())