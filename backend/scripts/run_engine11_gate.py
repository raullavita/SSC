"""Engine 11 gate — platform release + mediasoup full wiring."""

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
    from core.engine11 import engine11_complete  # noqa: PLC0415

    checks: list[dict] = [
        {
            "name": "engine11_complete_helper",
            "passed": engine11_complete(),
            "detail": "engine11_complete() is True",
        },
    ]

    for rel in [
        "memory/PLATFORM_RELEASE_CHARTER.md",
        "memory/SFU_CHARTER.md",
        "backend/core/engine11.py",
        "backend/core/platform_release_policy.py",
        "backend/core/sfu_client.py",
        "electron/libsignalSession.js",
        "electron/preload.js",
        "electron/electron-builder.yml",
        "android/app/src/main/java/com/supersecurechat/app/ApiClient.kt",
        "scripts/build_electron.ps1",
        "scripts/build_android.ps1",
        "sfu-server/roomManager.js",
        "sfu-server/wsHandler.js",
        "frontend/src/calls/sfuSession.js",
        "backend/tests/test_engine11_platform.py",
        "backend/tests/test_engine11_sfu.py",
        "backend/scripts/platform_release_proof.py",
        "backend/scripts/sfu_wiring_proof.py",
    ]:
        checks.append(_check_file(rel))

    charter = (REPO_ROOT / "memory" / "PLATFORM_RELEASE_CHARTER.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": "step 11.12" in charter.lower() or "11.12" in charter,
            "detail": "charter documents step 11.12 gate",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_engine11_platform.py",
            "tests/test_engine11_sfu.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "engine11_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-800:],
        }
    )

    for script in ["platform_release_proof.py", "sfu_wiring_proof.py"]:
        proof = subprocess.run(
            [sys.executable, f"scripts/{script}"],
            cwd=BACKEND_ROOT,
            capture_output=True,
            text=True,
        )
        checks.append(
            {
                "name": script.replace(".py", ""),
                "passed": proof.returncode == 0,
                "detail": "ok" if proof.returncode == 0 else (proof.stdout + proof.stderr)[-500:],
            }
        )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ENGINE 11 GATE PASSED" if passed else "ENGINE 11 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())