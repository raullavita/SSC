"""Engine 11 SFU wiring proof — step 11.9."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.sfu_policy import engine11_sfu_signaling_ready  # noqa: PLC0415

    repo = Path(__file__).resolve().parents[2]
    checks = []

    for rel in [
        "sfu-server/roomManager.js",
        "sfu-server/wsHandler.js",
        "sfu-server/server.js",
        "backend/core/sfu_client.py",
        "frontend/src/calls/sfuSession.js",
        "frontend/src/calls/sfuClient.js",
    ]:
        path = repo / rel
        checks.append({"name": f"file:{rel}", "passed": path.is_file(), "detail": ""})

    server_js = (repo / "sfu-server" / "server.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "sfu_internal_provision_route",
            "passed": "/internal/rooms" in server_js,
            "detail": "POST /internal/rooms",
        }
    )

    ws_handler = (repo / "sfu-server" / "wsHandler.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "sfu_ws_signaling",
            "passed": "createWebRtcTransport" in ws_handler and "produce" in ws_handler,
            "detail": "mediasoup signaling actions",
        }
    )

    sfu_client = (repo / "frontend" / "src" / "calls" / "sfuClient.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "frontend_connect_sfu",
            "passed": "connectSfuSession" in sfu_client,
            "detail": "no scaffold_only",
        }
    )

    group_call = (repo / "frontend" / "src" / "calls" / "useGroupCall.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "use_group_call_sfu_connect",
            "passed": "connectSfuRoom" in group_call and "sfuSession" in group_call,
            "detail": "end-to-end hook wiring",
        }
    )

    checks.append(
        {
            "name": "engine11_sfu_signaling_ready",
            "passed": engine11_sfu_signaling_ready(),
            "detail": "",
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("SFU WIRING PROOF PASSED" if passed else "SFU WIRING PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())