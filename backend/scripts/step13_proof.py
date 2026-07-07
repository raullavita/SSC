"""Step 13 proof — safety numbers + trust UX."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "trust_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "trust_policy",
            "passed": "TRUST_STATUSES" in policy and "ssc_trust_v1" in policy,
            "detail": "",
        }
    )

    trust_store = (REPO_ROOT / "frontend" / "src" / "lib" / "trustStore.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "client_trust_store",
            "passed": "markPeerVerified" in trust_store and "syncPeerSafetyNumber" in trust_store,
            "detail": "",
        }
    )

    hook = (REPO_ROOT / "frontend" / "src" / "chat" / "useTrustState.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "use_trust_state_hook",
            "passed": "computeSafetyNumber" in hook and "markVerified" in hook,
            "detail": "",
        }
    )

    modal = (REPO_ROOT / "frontend" / "src" / "components" / "chat" / "SafetyVerifyModal.jsx").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "safety_verify_modal",
            "passed": "Mark as verified" in modal and "SafetyQr" in modal,
            "detail": "",
        }
    )

    chat = (REPO_ROOT / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "chat_home_trust_ux",
            "passed": "useTrustState" in chat and "TrustBanner" in chat,
            "detail": "",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step13",
            "passed": "Step 13" in roadmap,
            "detail": "",
        }
    )

    backend_tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step13_trust.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step13_backend_tests",
            "passed": backend_tests.returncode == 0,
            "detail": "ok" if backend_tests.returncode == 0 else (backend_tests.stdout + backend_tests.stderr)[-500:],
        }
    )

    frontend_tests = subprocess.run(
        [
            "yarn",
            "test",
            "--watchAll=false",
            "src/lib/__tests__/trustStore.test.js",
            "src/components/chat/__tests__/SafetyVerifyModal.test.js",
            "src/components/chat/__tests__/TrustBanner.test.js",
        ],
        cwd=REPO_ROOT / "frontend",
        capture_output=True,
        text=True,
        shell=False,
    )
    checks.append(
        {
            "name": "step13_frontend_tests",
            "passed": frontend_tests.returncode == 0,
            "detail": "ok" if frontend_tests.returncode == 0 else (frontend_tests.stdout + frontend_tests.stderr)[-800:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 13 PROOF PASSED" if passed else "STEP 13 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())