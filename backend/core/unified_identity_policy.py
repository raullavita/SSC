"""
Unified identity policy — libsignal curve primary on installed clients.

See memory/UNIFIED_IDENTITY_CHARTER.md.
"""
from __future__ import annotations

from typing import List, Tuple

IDENTITY_PRIMARY_SIGNAL = "signal_v1"
RSA_KEY_ROLE = "vault_wrap_only"
BROWSER_REGISTRATION_ALLOWED = False

UNIFIED_IDENTITY_STEPS: List[Tuple[str, str, bool]] = [
    ("UI.1", "Charter + policy module + gate", True),
    ("UI.2", "identity_primary set on prekey upload", True),
    ("UI.3", "Installed clients require prekeys before chat", True),
    ("UI.4", "Safety number resolution prefers Signal identity", True),
    ("UI.5", "Browser register/chat gated (installed clients only)", True),
]

USER_IDENTITY_FIELDS: Tuple[str, ...] = (
    "signal_identity_key_public",
    "signal_prekeys_ready",
    "identity_primary",
    "public_key",
)


def unified_identity_complete() -> bool:
    return all(done for _, _, done in UNIFIED_IDENTITY_STEPS)


def is_unified_signal_user(user: dict) -> bool:
    if not user:
        return False
    return (
        user.get("identity_primary") == IDENTITY_PRIMARY_SIGNAL
        or bool(user.get("signal_prekeys_ready"))
    )