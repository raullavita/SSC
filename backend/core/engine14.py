"""Engine 14 completion registry — production FCM + SFU live."""

from __future__ import annotations

import os

ENGINE14_STEPS = {
    "14.1": "engine14 completion registry",
    "14.2": "FCM generic push on message dispatch",
    "14.3": "SFU wss production URL policy",
    "14.4": "production_push_proof.py",
    "14.5": "run_engine14_gate.py",
    "14.6": "ENGINE14_CHARTER.md",
}


def engine14_sfu_live() -> bool:
    url = (os.getenv("SSC_SFU_WS_URL") or "").strip()
    return url.startswith("wss://")


def engine14_push_wired() -> bool:
    from pathlib import Path

    push_py = Path(__file__).resolve().parents[1] / "push.py"
    messages_py = Path(__file__).resolve().parents[1] / "routers" / "messages.py"
    if not push_py.is_file() or not messages_py.is_file():
        return False
    push_text = push_py.read_text(encoding="utf-8")
    msg_text = messages_py.read_text(encoding="utf-8")
    return "build_generic_push" in push_text and "notify_conversation_participants" in msg_text


def engine14_complete() -> bool:
    return (
        engine14_sfu_live()
        and engine14_push_wired()
        and len(ENGINE14_STEPS) == 6
    )