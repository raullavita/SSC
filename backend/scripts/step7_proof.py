"""Step 7 proof — stories, polls, disappearing messages."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    sys.path.insert(0, str(BACKEND_ROOT))
    from core.poll_policy import engine7_polls_ready  # noqa: PLC0415
    from core.story_policy import engine7_stories_ready  # noqa: PLC0415

    checks: list[dict] = [
        {"name": "stories_policy_ready", "passed": engine7_stories_ready(), "detail": ""},
        {"name": "polls_policy_ready", "passed": engine7_polls_ready(), "detail": ""},
    ]

    for rel in [
        "backend/core/story_policy.py",
        "backend/core/poll_policy.py",
        "backend/routers/stories.py",
        "backend/routers/polls.py",
        "frontend/src/chat/stories.js",
        "frontend/src/chat/polls.js",
        "frontend/src/components/chat/StoriesBar.jsx",
        "frontend/src/components/chat/PollBubble.jsx",
        "frontend/src/chat/useDisappearingMessages.js",
    ]:
        path = REPO_ROOT / rel
        checks.append(
            {
                "name": f"file:{rel}",
                "passed": path.is_file(),
                "detail": "" if path.is_file() else "missing",
            }
        )

    messages_src = (BACKEND_ROOT / "routers" / "messages.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "messages_filter_expired",
            "passed": '"expires_at": {"$gt": now}' in messages_src,
            "detail": "list_messages filters expired rows",
        }
    )

    stories_src = (BACKEND_ROOT / "routers" / "stories.py").read_text(encoding="utf-8")
    polls_src = (BACKEND_ROOT / "routers" / "polls.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "stories_polls_routes",
            "passed": "router = APIRouter" in stories_src and "router = APIRouter" in polls_src,
            "detail": "",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_step7_stories_polls.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step7_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 7 PROOF PASSED" if passed else "STEP 7 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())