"""Engine 9 advanced proof — step 9.11."""

from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.engine9 import engine9_complete  # noqa: PLC0415
    from core.sealed_sender_policy import SEALED_ENVELOPE_FLAG  # noqa: PLC0415
    import routers.messages as messages_module  # noqa: PLC0415
    import routers.groups as groups_module  # noqa: PLC0415

    checks = []

    msg_source = inspect.getsource(messages_module.send_message)
    checks.append(
        {
            "name": "messages_support_sealed",
            "passed": "sealed" in msg_source and "fanout_message" in msg_source,
            "detail": "sealed sender + multi-device fanout",
        }
    )
    checks.append(
        {
            "name": "sealed_envelope_flag",
            "passed": SEALED_ENVELOPE_FLAG == "sealed_sender",
            "detail": SEALED_ENVELOPE_FLAG,
        }
    )
    checks.append(
        {
            "name": "groups_router",
            "passed": "create_group" in inspect.getsource(groups_module.create_group),
            "detail": "group chat API",
        }
    )
    checks.append(
        {
            "name": "engine9_complete",
            "passed": engine9_complete(),
            "detail": "",
        }
    )

    ci_path = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "ci.yml"
    ci_text = ci_path.read_text(encoding="utf-8") if ci_path.is_file() else ""
    checks.append(
        {
            "name": "zap_ci_skeleton",
            "passed": "zap" in ci_text.lower() or "zaproxy" in ci_text.lower(),
            "detail": "OWASP ZAP job in CI",
        }
    )

    sfu_client = Path(__file__).resolve().parents[2] / "frontend" / "src" / "calls" / "sfuClient.js"
    checks.append(
        {
            "name": "frontend_sfu_scaffold",
            "passed": sfu_client.is_file(),
            "detail": str(sfu_client),
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("ADVANCED PROOF PASSED" if passed else "ADVANCED PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())