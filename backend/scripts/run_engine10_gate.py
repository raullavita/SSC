"""Engine 10 gate — production deploy + platform scaffolds."""

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
    from core.engine10 import engine10_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine10_complete_helper",
            "passed": engine10_complete(),
            "detail": "engine10_complete() is True",
        },
    ]

    for rel in [
        "memory/DEPLOY_CHARTER.md",
        "backend/core/deploy_policy.py",
        "backend/core/engine10.py",
        "backend/Dockerfile",
        "firebase.json",
        ".firebaserc",
        "scripts/deploy_cloud_run.ps1",
        "scripts/deploy_hosting.ps1",
        "sfu-server/server.js",
        "sfu-server/package.json",
        "android/app/build.gradle.kts",
        "android/README.md",
        "frontend/.env.production.example",
        "backend/.env.production.example",
        ".github/workflows/deploy.yml",
        "backend/tests/test_deploy_policy.py",
        "backend/scripts/deploy_proof.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "DEPLOY_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 10.12" in charter.lower() or "10.12" in charter,
            "detail": "charter documents step 10.12 gate",
        }
    )

    tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_deploy_policy.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine10_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-500:],
        }
    )

    proof = subprocess.run(
        [sys.executable, "scripts/deploy_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "deploy_proof",
            "passed": proof.returncode == 0,
            "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 10 GATE PASSED" if passed else "ENGINE 10 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())