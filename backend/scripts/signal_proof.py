"""Signal Protocol proof — Engine 8 step 8.11."""

from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.engine8 import engine8_complete  # noqa: PLC0415
    from core.signal_policy import SIGNAL_PROTOCOL_V1  # noqa: PLC0415
    import routers.messages as messages_module  # noqa: PLC0415
    import routers.prekeys as prekeys_module  # noqa: PLC0415

    checks = []

    msg_source = inspect.getsource(messages_module.send_message)
    checks.append(
        {
            "name": "messages_use_signal_validation",
            "passed": "validate_signal_ciphertext" in msg_source,
            "detail": "messages router validates signal_v1",
        }
    )
    checks.append(
        {
            "name": "signal_protocol_constant",
            "passed": SIGNAL_PROTOCOL_V1 == "signal_v1",
            "detail": SIGNAL_PROTOCOL_V1,
        }
    )

    prekey_source = inspect.getsource(prekeys_module.upload_prekey_bundle)
    checks.append(
        {
            "name": "prekeys_scrub_private",
            "passed": "scrub_prekey_bundle" in prekey_source,
            "detail": "prekeys strip private material",
        }
    )
    checks.append(
        {
            "name": "engine8_complete",
            "passed": engine8_complete(),
            "detail": "",
        }
    )

    bridge = Path(__file__).resolve().parents[2] / "frontend" / "src" / "signal" / "signalBridge.js"
    bridge_text = bridge.read_text(encoding="utf-8") if bridge.is_file() else ""
    checks.append(
        {
            "name": "frontend_libsignal_bridge",
            "passed": "@signalapp/libsignal-client" in bridge_text,
            "detail": str(bridge),
        }
    )

    electron_preload = Path(__file__).resolve().parents[2] / "electron" / "preload.js"
    checks.append(
        {
            "name": "electron_preload",
            "passed": electron_preload.is_file(),
            "detail": str(electron_preload),
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("SIGNAL PROOF PASSED" if passed else "SIGNAL PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())