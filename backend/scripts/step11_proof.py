"""Step 11 proof — call reliability pass."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "call_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "call_end_reasons",
            "passed": "CALL_END_REASONS" in policy and "hangup" in policy,
            "detail": "",
        }
    )

    calls = (BACKEND_ROOT / "routers" / "calls.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "calls_end_route",
            "passed": "/end" in calls and "call_ended" in calls,
            "detail": "",
        }
    )

    push_payload = (BACKEND_ROOT / "core" / "push_payload.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "missed_call_push",
            "passed": "build_missed_call_push" in push_payload,
            "detail": "",
        }
    )

    use_call = (REPO_ROOT / "frontend" / "src" / "chat" / "useCall.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "use_call_ice_queue",
            "passed": "iceQueueRef" in use_call and "flushIceQueue" in use_call,
            "detail": "",
        }
    )
    checks.append(
        {
            "name": "use_call_end_and_timeout",
            "passed": "RING_TIMEOUT_MS" in use_call and "call_ended" in use_call,
            "detail": "",
        }
    )

    modal = (REPO_ROOT / "frontend" / "src" / "components" / "chat" / "CallModal.jsx").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "call_modal_status_labels",
            "passed": "STATUS_LABELS" in modal and "errorMessage" in modal,
            "detail": "",
        }
    )

    manifest = REPO_ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
    manifest_src = manifest.read_text(encoding="utf-8") if manifest.is_file() else ""
    checks.append(
        {
            "name": "android_webrtc_permissions",
            "passed": "RECORD_AUDIO" in manifest_src and "CAMERA" in manifest_src,
            "detail": "",
        }
    )

    main_kt = REPO_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "supersecurechat" / "app" / "MainActivity.kt"
    main_src = main_kt.read_text(encoding="utf-8") if main_kt.is_file() else ""
    checks.append(
        {
            "name": "android_webview_permission_grant",
            "passed": "onPermissionRequest" in main_src,
            "detail": "",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step11",
            "passed": "Step 11" in roadmap,
            "detail": "",
        }
    )

    backend_tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step11_calls.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step11_backend_tests",
            "passed": backend_tests.returncode == 0,
            "detail": "ok" if backend_tests.returncode == 0 else (backend_tests.stdout + backend_tests.stderr)[-500:],
        }
    )

    frontend_tests = subprocess.run(
        [
            "yarn",
            "test",
            "--watchAll=false",
            "src/chat/__tests__/useCall.test.js",
            "src/components/chat/__tests__/CallModal.test.js",
        ],
        cwd=REPO_ROOT / "frontend",
        capture_output=True,
        text=True,
        shell=False,
    )
    checks.append(
        {
            "name": "step11_frontend_tests",
            "passed": frontend_tests.returncode == 0,
            "detail": "ok" if frontend_tests.returncode == 0 else (frontend_tests.stdout + frontend_tests.stderr)[-800:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 11 PROOF PASSED" if passed else "STEP 11 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())