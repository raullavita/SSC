"""Engine 14 gate — production FCM + SFU live."""

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
    import os

    os.environ.setdefault("SSC_SFU_WS_URL", "wss://sfu.supersecurechat.com")
    os.environ.setdefault("SSC_SFU_ENABLED", "true")
    sys.path.insert(0, str(BACKEND_ROOT))
    from core.engine14 import engine14_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine14_complete_helper",
            "passed": engine14_complete(),
            "detail": "engine14_complete() is True",
        },
    ]

    for rel in [
        "memory/ENGINE14_CHARTER.md",
        "backend/core/engine14.py",
        "backend/scripts/production_push_proof.py",
        "backend/push.py",
        "backend/routers/push_router.py",
        "backend/core/sfu_policy.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "ENGINE14_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "14.5" in charter,
            "detail": "charter documents step 14.5 gate",
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/production_push_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "production_push_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 14 GATE PASSED" if passed else "ENGINE 14 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())