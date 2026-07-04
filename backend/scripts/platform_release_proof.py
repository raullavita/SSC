"""Engine 11 platform release proof — step 11.9."""

from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.engine11 import engine11_complete  # noqa: PLC0415
    from core.platform_release_policy import engine11_platform_release_ready  # noqa: PLC0415

    repo = Path(__file__).resolve().parents[2]
    checks = []

    electron_session = repo / "electron" / "libsignalSession.js"
    electron_preload = repo / "electron" / "preload.js"
    checks.append(
        {
            "name": "electron_libsignal_ipc",
            "passed": electron_session.is_file() and "signalEncrypt" in electron_session.read_text(encoding="utf-8"),
            "detail": str(electron_session),
        }
    )
    checks.append(
        {
            "name": "electron_preload_ipc",
            "passed": "ipcRenderer.invoke" in electron_preload.read_text(encoding="utf-8"),
            "detail": str(electron_preload),
        }
    )

    android_api = repo / "android" / "app" / "src" / "main" / "java" / "com" / "supersecurechat" / "app" / "ApiClient.kt"
    checks.append(
        {
            "name": "android_api_client",
            "passed": android_api.is_file() and "X-SSC-Client" in android_api.read_text(encoding="utf-8"),
            "detail": str(android_api),
        }
    )

    gradle = repo / "android" / "app" / "build.gradle.kts"
    gradle_text = gradle.read_text(encoding="utf-8") if gradle.is_file() else ""
    checks.append(
        {
            "name": "android_libsignal_dep",
            "passed": "libsignal-android" in gradle_text,
            "detail": "org.signal:libsignal-android",
        }
    )

    build_electron = repo / "scripts" / "build_electron.ps1"
    build_android = repo / "scripts" / "build_android.ps1"
    checks.append({"name": "build_electron_script", "passed": build_electron.is_file(), "detail": ""})
    checks.append({"name": "build_android_script", "passed": build_android.is_file(), "detail": ""})

    bridge = repo / "frontend" / "src" / "signal" / "signalBridge.js"
    bridge_src = bridge.read_text(encoding="utf-8") if bridge.is_file() else ""
    checks.append(
        {
            "name": "signal_bridge_establish_session",
            "passed": "establishSession" in bridge_src,
            "detail": "pre-encrypt session bootstrap",
        }
    )

    checks.append(
        {
            "name": "platform_release_ready",
            "passed": engine11_platform_release_ready(),
            "detail": "",
        }
    )
    checks.append(
        {
            "name": "engine11_complete",
            "passed": engine11_complete(),
            "detail": inspect.getsource(engine11_complete).strip(),
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("PLATFORM RELEASE PROOF PASSED" if passed else "PLATFORM RELEASE PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())