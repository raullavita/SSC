"""Step 10 proof — usernames + invite links."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "username_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "username_policy",
            "passed": "validate_username" in policy and "invite_web_url" in policy,
            "detail": "",
        }
    )

    lifespan = (BACKEND_ROOT / "core" / "lifespan.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "username_unique_index",
            "passed": "ensure_username_index" in lifespan and "uniq_username" in lifespan,
            "detail": "",
        }
    )

    users = (BACKEND_ROOT / "routers" / "users.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "users_username_routes",
            "passed": "/by-username/" in users and "/me/username" in users,
            "detail": "",
        }
    )

    auth = (BACKEND_ROOT / "routers" / "auth.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "auth_me_includes_username",
            "passed": '"username"' in auth,
            "detail": "",
        }
    )

    for rel, needles in [
        ("frontend/src/lib/inviteLink.js", ["inviteWebUrl", "lookupPathForQuery"]),
        ("frontend/src/components/DeviceLinkQr.jsx", ["QRCode"]),
        ("frontend/src/pages/AddContact.jsx", ["/api/conversations"]),
        ("frontend/src/pages/AddContactLanding.jsx", ["Download"]),
        ("frontend/src/components/chat/UserLookup.jsx", ["@username"]),
        ("frontend/src/pages/Settings.jsx", ["/api/users/me/username"]),
        ("frontend/src/App.js", ["/add/:username"]),
    ]:
        path = REPO_ROOT / rel
        src = path.read_text(encoding="utf-8") if path.is_file() else ""
        checks.append(
            {
                "name": f"file:{rel}",
                "passed": path.is_file() and all(n in src for n in needles),
                "detail": "",
            }
        )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step10",
            "passed": "Step 10" in roadmap and "username" in roadmap.lower(),
            "detail": "",
        }
    )

    tests = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_username_policy.py",
            "tests/test_step10_usernames.py",
            "-q",
            "--tb=line",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step10_unit_tests",
            "passed": tests.returncode == 0,
            "detail": "ok" if tests.returncode == 0 else (tests.stdout + tests.stderr)[-500:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 10 PROOF PASSED" if passed else "STEP 10 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())