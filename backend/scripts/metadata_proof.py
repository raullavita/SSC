"""Metadata minimization proof — Engine 4 step 4.7."""

from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.metadata_policy import engine4_metadata_policy_ready  # noqa: PLC0415
    from core.push_payload import build_generic_push  # noqa: PLC0415
    import push as push_module  # noqa: PLC0415

    checks = []

    payload = build_generic_push()
    checks.append(
        {
            "name": "generic_push_title",
            "passed": payload.get("title") == "SSC",
            "detail": payload.get("title", ""),
        }
    )
    checks.append(
        {
            "name": "generic_push_body",
            "passed": payload.get("body") == "New message",
            "detail": payload.get("body", ""),
        }
    )
    checks.append(
        {
            "name": "push_uses_build_generic_push",
            "passed": "build_generic_push" in inspect.getsource(push_module.send_generic_push_to_user),
            "detail": "push.py wired to build_generic_push",
        }
    )
    checks.append(
        {
            "name": "metadata_policy_ready",
            "passed": engine4_metadata_policy_ready(),
            "detail": "",
        }
    )

    sw_path = Path(__file__).resolve().parents[2] / "frontend" / "public" / "sw.js"
    sw_text = sw_path.read_text(encoding="utf-8") if sw_path.is_file() else ""
    checks.append(
        {
            "name": "sw_origin_check",
            "passed": "event.origin" in sw_text or "self.location.origin" in sw_text,
            "detail": "service worker validates origin",
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("METADATA PROOF PASSED" if passed else "METADATA PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())