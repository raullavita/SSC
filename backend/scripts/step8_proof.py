"""Step 8 proof — Release v0.2.0 checklist gate."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
VERSION = "0.2.0"


def _read(rel: str) -> str:
    path = REPO_ROOT / rel
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def main() -> int:
    checks: list[dict] = []

    changelog = _read("CHANGELOG.md")
    checks.append(
        {
            "name": "changelog_v020",
            "passed": f"## [{VERSION}]" in changelog,
            "detail": "CHANGELOG.md documents v0.2.0",
        }
    )

    readme = _read("README.md")
    checks.append(
        {
            "name": "readme_oss_compliance",
            "passed": "AGPL" in readme and "libsignal" in readme and "github.com/raullavita/SSC" in readme,
            "detail": "README open-source section",
        }
    )

    notices = _read("THIRD_PARTY_NOTICES.md")
    checks.append(
        {
            "name": "third_party_libsignal_agpl",
            "passed": "libsignal" in notices.lower() and "AGPL" in notices,
            "detail": "THIRD_PARTY_NOTICES libsignal AGPL",
        }
    )

    landing = _read("frontend/src/pages/Landing.jsx")
    checks.append(
        {
            "name": "landing_open_source_section",
            "passed": 'id="open-source"' in landing and "libsignal" in landing.lower(),
            "detail": "Landing OSS compliance section",
        }
    )

    env_example = _read("frontend/.env.production.example")
    checks.append(
        {
            "name": "landing_only_production_example",
            "passed": "REACT_APP_SSC_LANDING_ONLY=true" in env_example,
            "detail": "Hosting build is landing-only",
        }
    )

    checklist = REPO_ROOT / "memory" / "RELEASE_v0.2.0_CHECKLIST.md"
    checks.append(
        {
            "name": "release_checklist",
            "passed": checklist.is_file() and VERSION in checklist.read_text(encoding="utf-8"),
            "detail": str(checklist),
        }
    )

    for rel, pattern in [
        ("scripts/build_electron.ps1", rf'REACT_APP_SSC_VERSION\s*=\s*"{VERSION}"'),
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
            "detail": "health endpoint reports 0.2.0",
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
        [sys.executable, "-m", "pytest", "tests/test_step8_release.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step8_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 8 PROOF PASSED" if passed else "STEP 8 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())