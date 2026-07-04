"""Engine 9 completion registry — multi-device, sealed sender, groups, SFU."""

from __future__ import annotations

from core.group_policy import engine9_group_ready
from core.multi_device_policy import engine9_multi_device_ready
from core.sealed_sender_policy import engine9_sealed_sender_ready
from core.sfu_policy import engine9_sfu_ready

ENGINE9_STEPS = {
    "9.1": "multi-device link tokens + device cap",
    "9.2": "device link API",
    "9.3": "sealed sender policy + metadata stripping",
    "9.4": "sealed message relay in messages router",
    "9.5": "group chat API",
    "9.6": "multi-device WS fanout",
    "9.7": "SFU policy + mediasoup room scaffold",
    "9.8": "group call SFU mode selection",
    "9.9": "frontend hooks (no app packaging)",
    "9.10": "OWASP ZAP CI skeleton",
    "9.11": "advanced_proof + unit tests",
    "9.12": "run_engine9_gate.py",
}


def engine9_complete() -> bool:
    return (
        engine9_multi_device_ready()
        and engine9_sealed_sender_ready()
        and engine9_group_ready()
        and engine9_sfu_ready()
        and len(ENGINE9_STEPS) == 12
    )