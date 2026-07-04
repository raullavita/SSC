"""Engine 2 gate — installed-client enforcement."""

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
    from core.installed_client_policy import engine2_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine2_complete_helper",
            "passed": engine2_complete(),
            "detail": "engine2_complete() is True",
        },
    ]

    for rel in [
        "memory/INSTALLED_CLIENT_CHARTER.md",
        "backend/core/installed_client_policy.py",
        "backend/routers/config.py",
        "frontend/src/lib/api.js",
        "frontend/src/lib/installedClient.js",
        "backend/tests/test_installed_client.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "INSTALLED_CLIENT_CHARTER.md").read_text(encoding="utf-8")
    charter_ok = "step 2.7" in charter.lower() or "2.7" in charter
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": charter_ok,
            "detail": "charter documents step 2.7 gate",
        }
    )

    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_installed_client.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine2_unit_tests",
            "passed": result.returncode == 0,
            "detail": "ok" if result.returncode == 0 else (result.stdout + result.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 2 GATE PASSED" if passed else "ENGINE 2 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())