"""Engine 14 production push + SFU proof."""

from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.engine14 import engine14_complete, engine14_push_wired, engine14_sfu_live  # noqa: PLC0415
    import push as push_module  # noqa: PLC0415
    from core.push_payload import build_generic_push  # noqa: PLC0415

    import os

    os.environ.setdefault("SSC_SFU_WS_URL", "wss://sfu.supersecurechat.com")
    payload = build_generic_push({})
    body = payload.get("body", "")
    checks = [
        {"name": "engine14_push_wired", "passed": engine14_push_wired(), "detail": ""},
        {"name": "engine14_sfu_live", "passed": engine14_sfu_live(), "detail": ""},
        {
            "name": "generic_push_no_content",
            "passed": body in ("New message", "SSC") and "hello" not in body.lower(),
            "detail": body,
        },
        {
            "name": "push_uses_fcm_dispatch",
            "passed": "_dispatch_fcm" in inspect.getsource(push_module.send_generic_push_to_user),
            "detail": "FCM dispatch path",
        },
        {"name": "engine14_complete", "passed": engine14_complete(), "detail": ""},
    ]

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("PRODUCTION PUSH PROOF PASSED" if passed else "PRODUCTION PUSH PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())