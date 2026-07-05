"""Step 9 proof — read receipts UI + fanout (privacy opt-in, issue #4)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    read_src = (BACKEND_ROOT / "core" / "read_receipts.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "read_receipts_opt_in_gate",
            "passed": 'settings.get("read_receipts")' in read_src,
            "detail": "privacy_settings.read_receipts respected",
        }
    )
    checks.append(
        {
            "name": "read_receipts_ws_fanout",
            "passed": '"type": "read_receipt"' in read_src and "ws_hub.publish" in read_src,
            "detail": "WS fanout on mark read",
        }
    )
    checks.append(
        {
            "name": "read_receipts_list_api",
            "passed": "list_read_receipts_for_sender" in read_src
            and "public_read_receipt" in read_src,
            "detail": "hydrate reads for sender",
        }
    )

    conv_src = (BACKEND_ROOT / "routers" / "conversations.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "conversations_reads_route",
            "passed": '/reads"' in conv_src or '"/reads"' in conv_src or '"/{conversation_id}/reads"' in conv_src,
            "detail": "GET /api/conversations/{id}/reads",
        }
    )

    hook = REPO_ROOT / "frontend" / "src" / "chat" / "useReadReceipts.js"
    hook_src = hook.read_text(encoding="utf-8") if hook.is_file() else ""
    checks.append(
        {
            "name": "frontend_use_read_receipts",
            "passed": "user:${userId}" in hook_src and "/reads" in hook_src,
            "detail": "dual WS subscribe + API hydrate",
        }
    )

    bubble = REPO_ROOT / "frontend" / "src" / "components" / "chat" / "MessageBubble.jsx"
    bubble_src = bubble.read_text(encoding="utf-8") if bubble.is_file() else ""
    checks.append(
        {
            "name": "message_bubble_double_check",
            "passed": "readAt" in bubble_src and "✓✓" in bubble_src,
            "detail": "outgoing read marks",
        }
    )

    settings = REPO_ROOT / "frontend" / "src" / "pages" / "Settings.jsx"
    settings_src = settings.read_text(encoding="utf-8") if settings.is_file() else ""
    checks.append(
        {
            "name": "settings_read_receipts_toggle",
            "passed": "read_receipts" in settings_src,
            "detail": "privacy opt-in toggle",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step9",
            "passed": "Step 9" in roadmap and "read receipt" in roadmap.lower(),
            "detail": "ROADMAP documents Step 9",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_read_receipts.py",
            "tests/test_step9_read_receipts.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step9_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 9 PROOF PASSED" if passed else "STEP 9 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())