"""Step 12 proof — message edit, delete, forward."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "message_lifecycle_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "lifecycle_policy",
            "passed": "EDIT_WINDOW_SECONDS" in policy and "DELETE_FOR_EVERYONE_WINDOW_SECONDS" in policy,
            "detail": "",
        }
    )

    messages = (BACKEND_ROOT / "routers" / "messages.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "messages_edit_delete_routes",
            "passed": '@router.patch("/messages/{message_id}")' in messages
            and '@router.delete("/messages/{message_id}")' in messages
            and "forwarded_from" in messages,
            "detail": "",
        }
    )

    fanout = (BACKEND_ROOT / "core" / "message_fanout.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "message_lifecycle_fanout",
            "passed": "fanout_message_edited" in fanout and "fanout_message_deleted" in fanout,
            "detail": "",
        }
    )

    actions = (REPO_ROOT / "frontend" / "src" / "chat" / "messageActions.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "frontend_message_actions",
            "passed": "editMessageApi" in actions and "forwardMessageApi" in actions,
            "detail": "",
        }
    )

    bubble = (REPO_ROOT / "frontend" / "src" / "components" / "chat" / "MessageBubble.jsx").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "message_bubble_lifecycle_ui",
            "passed": "onEdit" in bubble and "This message was deleted" in bubble,
            "detail": "",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step12",
            "passed": "Step 12" in roadmap,
            "detail": "",
        }
    )

    backend_tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step12_messages.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step12_backend_tests",
            "passed": backend_tests.returncode == 0,
            "detail": "ok" if backend_tests.returncode == 0 else (backend_tests.stdout + backend_tests.stderr)[-500:],
        }
    )

    frontend_tests = subprocess.run(
        [
            "yarn",
            "test",
            "--watchAll=false",
            "src/chat/__tests__/messageActions.test.js",
            "src/components/chat/__tests__/MessageBubble.lifecycle.test.js",
        ],
        cwd=REPO_ROOT / "frontend",
        capture_output=True,
        text=True,
        shell=True,
    )
    checks.append(
        {
            "name": "step12_frontend_tests",
            "passed": frontend_tests.returncode == 0,
            "detail": "ok" if frontend_tests.returncode == 0 else (frontend_tests.stdout + frontend_tests.stderr)[-800:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 12 PROOF PASSED" if passed else "STEP 12 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())