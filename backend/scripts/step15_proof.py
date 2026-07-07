"""Step 15 proof — multi-device QR link polish."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "multi_device_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "multi_device_link_helpers",
            "passed": "build_device_link_deep_link" in policy and "step15_multi_device_polish_ready" in policy,
            "detail": "",
        }
    )

    link_router = (BACKEND_ROOT / "routers" / "device_link.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "device_link_qr_metadata",
            "passed": "deep_link" in link_router and "expires_in_seconds" in link_router,
            "detail": "",
        }
    )

    panel = (REPO_ROOT / "frontend" / "src" / "components" / "LinkedDevicesPanel.jsx").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "linked_devices_panel",
            "passed": "DeviceLinkQr" in panel and "Generate QR link" in panel,
            "detail": "",
        }
    )

    device_link_page = (REPO_ROOT / "frontend" / "src" / "pages" / "DeviceLink.jsx").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "device_link_page_polish",
            "passed": "Link this device" in device_link_page and "registerDeviceAndPrekeys" in device_link_page,
            "detail": "",
        }
    )

    chat = (REPO_ROOT / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "chat_sync_entry",
            "passed": "Linked devices" in chat,
            "detail": "",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step15",
            "passed": "Step 15" in roadmap,
            "detail": "",
        }
    )

    backend_tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step15_multi_device.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step15_backend_tests",
            "passed": backend_tests.returncode == 0,
            "detail": "ok" if backend_tests.returncode == 0 else (backend_tests.stdout + backend_tests.stderr)[-500:],
        }
    )

    frontend_tests = subprocess.run(
        [
            "yarn",
            "test",
            "--watchAll=false",
            "src/lib/__tests__/deviceLink.test.js",
            "src/components/__tests__/LinkedDevicesPanel.test.js",
        ],
        cwd=REPO_ROOT / "frontend",
        capture_output=True,
        text=True,
        shell=False,
    )
    checks.append(
        {
            "name": "step15_frontend_tests",
            "passed": frontend_tests.returncode == 0,
            "detail": "ok" if frontend_tests.returncode == 0 else (frontend_tests.stdout + frontend_tests.stderr)[-800:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 15 PROOF PASSED" if passed else "STEP 15 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())