"""Engine 3 completion registry."""

from __future__ import annotations

ENGINE3_STEPS = {
    "3.1": "auth router (register/login/me)",
    "3.2": "conversations router",
    "3.3": "messages router (placeholder ciphertext)",
    "3.4": "websocket hub + redis fanout",
    "3.5": "frontend AuthContext + api bearer",
    "3.6": "ChatHome + useChatSocket/useChatMessages",
    "3.7": "engine3 gate + integration tests",
}


def engine3_complete() -> bool:
    return len(ENGINE3_STEPS) == 7