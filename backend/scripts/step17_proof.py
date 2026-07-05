"""Step 17 proof — Android shell UX polish."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "android_shell_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "android_shell_policy",
            "passed": "step17_android_shell_ready" in policy and "deep_links" in policy,
            "detail": "",
        }
    )

    manifest = (REPO_ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "android_manifest_deep_links",
            "passed": 'android:scheme="ssc"' in manifest and "Theme.SSC.Splash" in manifest,
            "detail": "",
        }
    )

    main_activity = (
        REPO_ROOT
        / "android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "com"
        / "supersecurechat"
        / "app"
        / "MainActivity.kt"
    ).read_text(encoding="utf-8")
    checks.append(
        {
            "name": "main_activity_polish",
            "passed": "SwipeRefreshLayout" in main_activity and "onShowFileChooser" in main_activity,
            "detail": "",
        }
    )

    deep_link = (
        REPO_ROOT
        / "android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "com"
        / "supersecurechat"
        / "app"
        / "SscDeepLink.kt"
    ).read_text(encoding="utf-8")
    checks.append(
        {
            "name": "ssc_deep_link_resolver",
            "passed": "resolveToWebUrl" in deep_link,
            "detail": "",
        }
    )

    installed_client = (REPO_ROOT / "frontend" / "src" / "lib" / "installedClient.js").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "android_shell_frontend_hooks",
            "passed": "isAndroidShell" in installed_client and "__SSC_ANDROID_FEATURES" in installed_client,
            "detail": "",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step17",
            "passed": "Step 17" in roadmap
            and "Shipped" in roadmap.split("Step 17")[1].split("Step 18")[0],
            "detail": "",
        }
    )

    backend_tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step17_android_shell.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step17_backend_tests",
            "passed": backend_tests.returncode == 0,
            "detail": "ok" if backend_tests.returncode == 0 else (backend_tests.stdout + backend_tests.stderr)[-500:],
        }
    )

    frontend_tests = subprocess.run(
        [
            "yarn",
            "test",
            "--watchAll=false",
            "src/lib/__tests__/installedClient.test.js",
        ],
        cwd=REPO_ROOT / "frontend",
        capture_output=True,
        text=True,
        shell=True,
    )
    checks.append(
        {
            "name": "step17_frontend_tests",
            "passed": frontend_tests.returncode == 0,
            "detail": "ok" if frontend_tests.returncode == 0 else (frontend_tests.stdout + frontend_tests.stderr)[-800:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 17 PROOF PASSED" if passed else "STEP 17 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())