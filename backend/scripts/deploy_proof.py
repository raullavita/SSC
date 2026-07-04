"""Production deploy proof — Engine 10 step 10.10."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"


def main() -> int:
    sys.path.insert(0, str(BACKEND_ROOT))
    from core.engine10 import engine10_complete  # noqa: PLC0415

    checks = []

    dockerfile = BACKEND_ROOT / "Dockerfile"
    checks.append(
        {
            "name": "dockerfile_exists",
            "passed": dockerfile.is_file(),
            "detail": str(dockerfile),
        }
    )
    if dockerfile.is_file():
        text = dockerfile.read_text(encoding="utf-8")
        checks.append(
            {
                "name": "dockerfile_uvicorn",
                "passed": "uvicorn server:app" in text,
                "detail": "Cloud Run entrypoint",
            }
        )

    firebase = REPO_ROOT / "firebase.json"
    checks.append(
        {
            "name": "firebase_json",
            "passed": firebase.is_file(),
            "detail": str(firebase),
        }
    )

    sfu = REPO_ROOT / "sfu-server" / "server.js"
    checks.append(
        {
            "name": "mediasoup_scaffold",
            "passed": sfu.is_file(),
            "detail": str(sfu),
        }
    )

    android = REPO_ROOT / "android" / "app" / "build.gradle.kts"
    checks.append(
        {
            "name": "android_scaffold",
            "passed": android.is_file(),
            "detail": str(android),
        }
    )

    deploy_cr = REPO_ROOT / "scripts" / "deploy_cloud_run.ps1"
    deploy_host = REPO_ROOT / "scripts" / "deploy_hosting.ps1"
    checks.append(
        {
            "name": "deploy_scripts",
            "passed": deploy_cr.is_file() and deploy_host.is_file(),
            "detail": "cloud run + hosting",
        }
    )

    checks.append(
        {
            "name": "engine10_complete",
            "passed": engine10_complete(),
            "detail": "",
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("DEPLOY PROOF PASSED" if passed else "DEPLOY PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())