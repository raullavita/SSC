"""Step 14 proof — per-chat privacy controls."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "conversation_privacy_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "conversation_privacy_policy",
            "passed": "effective_read_receipts" in policy and "effective_typing_visible" in policy,
            "detail": "",
        }
    )

    conv = (BACKEND_ROOT / "routers" / "conversations.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "conversation_privacy_route",
            "passed": '/privacy' in conv and "ConversationPrivacyPatch" in conv,
            "detail": "",
        }
    )

    panel = (REPO_ROOT / "frontend" / "src" / "components" / "chat" / "ChatPrivacyPanel.jsx").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "chat_privacy_panel",
            "passed": "Read receipts" in panel and "Disappearing default" in panel,
            "detail": "",
        }
    )

    chat = (REPO_ROOT / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "chat_home_privacy_wiring",
            "passed": "ChatPrivacyPanel" in chat and "useConversationPrivacy" in chat,
            "detail": "",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step14",
            "passed": "Step 14" in roadmap,
            "detail": "",
        }
    )

    backend_tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step14_conversation_privacy.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step14_backend_tests",
            "passed": backend_tests.returncode == 0,
            "detail": "ok" if backend_tests.returncode == 0 else (backend_tests.stdout + backend_tests.stderr)[-500:],
        }
    )

    frontend_tests = subprocess.run(
        [
            "yarn",
            "test",
            "--watchAll=false",
            "src/lib/__tests__/conversationPrivacy.test.js",
            "src/components/chat/__tests__/ChatPrivacyPanel.test.js",
        ],
        cwd=REPO_ROOT / "frontend",
        capture_output=True,
        text=True,
        shell=True,
    )
    checks.append(
        {
            "name": "step14_frontend_tests",
            "passed": frontend_tests.returncode == 0,
            "detail": "ok" if frontend_tests.returncode == 0 else (frontend_tests.stdout + frontend_tests.stderr)[-800:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 14 PROOF PASSED" if passed else "STEP 14 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())