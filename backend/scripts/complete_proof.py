"""Engine 13 complete proof — step 13.9."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.engine13 import engine13_complete, engine13_no_ai_enforced  # noqa: PLC0415

    repo = Path(__file__).resolve().parents[2]
    checks = []

    checks.append({"name": "legacy_llm_removed", "passed": engine13_no_ai_enforced(), "detail": ""})

    for rel in [
        "frontend/src/signal/safetyNumber.js",
        "frontend/src/chat/reactions.js",
        "backend/core/pqxdh_policy.py",
        "backend/core/reaction_policy.py",
        "scripts/validate_deploy.ps1",
        "memory/ENGINE13_CHARTER.md",
    ]:
        checks.append({"name": f"file:{rel}", "passed": (repo / rel).is_file(), "detail": ""})

    checks.append(
        {
            "name": "smart_router_removed",
            "passed": not (repo / "backend" / "routers" / "smart.py").is_file(),
            "detail": "legacy /api/smart removed",
        }
    )

    chat = (repo / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "safety_number_ui",
            "passed": "safetyNumber" in chat and "SafetyVerifyModal" in chat,
            "detail": "",
        }
    )
    checks.append(
        {
            "name": "reactions_threads_ui",
            "passed": "sendReaction" in chat and "replyTo" in chat,
            "detail": "",
        }
    )

    electron = (repo / "electron" / "libsignalSession.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "fingerprint_ipc",
            "passed": "computeSafetyNumber" in electron and "Fingerprint" in electron,
            "detail": "",
        }
    )

    checks.append({"name": "engine13_complete", "passed": engine13_complete(), "detail": ""})

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("COMPLETE PROOF PASSED" if passed else "COMPLETE PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())