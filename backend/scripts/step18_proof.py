"""Step 18 proof — Release v0.3.0 checklist gate."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
VERSION = "0.3.0"


def _read(rel: str) -> str:
    path = REPO_ROOT / rel
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def main() -> int:
    checks: list[dict] = []

    changelog = _read("CHANGELOG.md")
    checks.append(
        {
            "name": "changelog_v030",
            "passed": f"## [{VERSION}]" in changelog,
            "detail": "CHANGELOG.md documents v0.3.0",
        }
    )

    readme = _read("README.md")
    checks.append(
        {
            "name": "readme_latest_release",
            "passed": f"v{VERSION}" in readme and "github.com/raullavita/SSC" in readme,
            "detail": "README points to v0.3.0",
        }
    )

    checklist = REPO_ROOT / "memory" / f"RELEASE_v{VERSION}_CHECKLIST.md"
    checks.append(
        {
            "name": "release_checklist",
            "passed": checklist.is_file() and VERSION in checklist.read_text(encoding="utf-8"),
            "detail": str(checklist),
        }
    )

    policy = _read("backend/core/release_policy.py")
    checks.append(
        {
            "name": "release_policy",
            "passed": "step18_release_ready" in policy and VERSION in policy,
            "detail": "",
        }
    )

    for rel, pattern in [
        ("scripts/build_electron.ps1", rf'REACT_APP_SSC_VERSION\s*=\s*"{VERSION}"'),
        ("scripts/build_android.ps1", rf'\$Version\s*=\s*"{VERSION}"'),
        ("android/app/build.gradle.kts", rf'versionName\s*=\s*"{VERSION}"'),
        ("android/app/src/main/java/com/supersecurechat/app/ApiClient.kt", rf'android/{VERSION}/'),
        ("electron/package.json", rf'"version":\s*"{VERSION}"'),
        ("frontend/package.json", rf'"version":\s*"{VERSION}"'),
    ]:
        src = _read(rel)
        checks.append(
            {
                "name": f"version:{rel}",
                "passed": bool(re.search(pattern, src)),
                "detail": f"expects {VERSION}",
            }
        )

    health = _read("backend/routers/health.py")
    checks.append(
        {
            "name": "api_health_version",
            "passed": VERSION in health,
            "detail": f"health endpoint reports {VERSION}",
        }
    )

    electron_artifact = REPO_ROOT / "electron" / "dist" / f"SSC-Setup-{VERSION}.exe"
    android_artifact = (
        REPO_ROOT / "android" / "app" / "build" / "outputs" / "apk" / "release" / f"SSC-{VERSION}.apk"
    )
    checks.append(
        {
            "name": "electron_installer_artifact",
            "passed": electron_artifact.is_file() and electron_artifact.stat().st_size > 1_000_000,
            "detail": str(electron_artifact),
        }
    )
    checks.append(
        {
            "name": "android_apk_artifact",
            "passed": android_artifact.is_file() and android_artifact.stat().st_size > 1_000_000,
            "detail": str(android_artifact),
        }
    )

    platform = subprocess.run(
        [sys.executable, "scripts/platform_release_proof.py"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "platform_release_proof",
            "passed": platform.returncode == 0,
            "detail": "ok" if platform.returncode == 0 else (platform.stdout + platform.stderr)[-400:],
        }
    )

    tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step18_release.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step18_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-500:],
        }
    )

    roadmap = _read("memory/ROADMAP.md")
    checks.append(
        {
            "name": "roadmap_step18",
            "passed": "Step 18" in roadmap
            and "Shipped" in roadmap.split("Step 18")[1].split("Community")[0],
            "detail": "",
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 18 PROOF PASSED" if passed else "STEP 18 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())