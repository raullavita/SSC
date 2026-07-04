"""Engine 13 complete proof — step 13.9."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.engine13 import engine13_complete  # noqa: PLC0415
    from core.smart_policy import NO_INSIDE_AI  # noqa: PLC0415

    repo = Path(__file__).resolve().parents[2]
    checks = []

    checks.append({"name": "no_inside_ai", "passed": NO_INSIDE_AI is True, "detail": ""})

    for rel in [
        "frontend/src/signal/safetyNumber.js",
        "frontend/src/chat/reactions.js",
        "backend/core/pqxdh_policy.py",
        "backend/core/reaction_policy.py",
        "scripts/validate_deploy.ps1",
        "memory/ENGINE13_CHARTER.md",
    ]:
        checks.append({"name": f"file:{rel}", "passed": (repo / rel).is_file(), "detail": ""})

    smart_cfg = (repo / "backend" / "routers" / "smart.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "smart_replies_disabled",
            "passed": '"smart_replies": False' in smart_cfg,
            "detail": "no inside AI in API",
        }
    )

    ollama_gone = not (repo / "frontend" / "src" / "smart" / "smartReply.js").exists()
    checks.append({"name": "ollama_removed", "passed": ollama_gone, "detail": "smartReply.js deleted"})

    chat = (repo / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "safety_number_ui",
            "passed": "computeSafetyNumber" in chat and "safetyNumber" in chat,
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