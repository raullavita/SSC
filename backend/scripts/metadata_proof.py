"""Metadata minimization proof — Engine 4 step 4.7."""

from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.metadata_policy import (  # noqa: PLC0415
        FORBIDDEN_RESPONSE_FIELDS,
        engine4_metadata_policy_ready,
        scrub_payload,
    )
    from core.push_payload import build_generic_push  # noqa: PLC0415
    from routers.auth import _user_payload  # noqa: PLC0415
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

    auth_out = _user_payload(
        {"_id": "u_x", "email": "hidden@test.com", "display_name": "Hidden"}
    )
    checks.append(
        {
            "name": "auth_payload_omits_email",
            "passed": "email" not in auth_out and auth_out.get("id") == "u_x",
            "detail": str(sorted(auth_out.keys())),
        }
    )
    checks.append(
        {
            "name": "forbidden_includes_participants",
            "passed": "participants" in FORBIDDEN_RESPONSE_FIELDS,
            "detail": "",
        }
    )
    checks.append(
        {
            "name": "fanout_scrub_nested_participants",
            "passed": "participants"
            not in scrub_payload({"message": {"participants": ["u_a"]}})["message"],
            "detail": "recursive scrub",
        }
    )

    fanout_src = (Path(__file__).resolve().parents[1] / "core" / "message_fanout.py").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "fanout_no_participants_broadcast",
            "passed": '"participants": participants' not in fanout_src,
            "detail": "conversation topic must not include participants array",
        }
    )

    devices_src = (Path(__file__).resolve().parents[1] / "routers" / "devices.py").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "devices_list_omits_last_active",
            "passed": '"last_active": d.get("last_active")' not in devices_src,
            "detail": "no precise timestamps in device list API",
        }
    )

    chat_prefs = (
        Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "chatPrefs.js"
    ).read_text(encoding="utf-8")
    checks.append(
        {
            "name": "sealed_sender_default_on",
            "passed": "if (stored === null) return true" in chat_prefs,
            "detail": "sealed sender enabled unless user opts out",
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("METADATA PROOF PASSED" if passed else "METADATA PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())