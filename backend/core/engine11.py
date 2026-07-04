"""Engine 11 completion registry — platform release + mediasoup full wiring."""

from __future__ import annotations

from core.platform_release_policy import engine11_platform_release_ready
from core.sfu_policy import engine11_sfu_signaling_ready

ENGINE11_STEPS = {
    "11.1": "Electron libsignal IPC bridge (main process)",
    "11.2": "electron-builder + local build script",
    "11.3": "Android libsignal-android + ApiClient WebView shell",
    "11.4": "Android local build script",
    "11.5": "mediasoup roomManager + WebSocket signaling",
    "11.6": "backend sfu_client provisioning",
    "11.7": "frontend mediasoup-client sfuSession",
    "11.8": "useGroupCall SFU connect wiring",
    "11.9": "platform_release_proof + sfu_wiring_proof",
    "11.10": "unit tests",
    "11.11": "PLATFORM_RELEASE_CHARTER.md",
    "11.12": "run_engine11_gate.py",
}


def engine11_complete() -> bool:
    return (
        engine11_platform_release_ready()
        and engine11_sfu_signaling_ready()
        and len(ENGINE11_STEPS) == 12
    )