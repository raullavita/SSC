"""Account recovery key policy — hash-only server storage — Phase C5."""

from __future__ import annotations

RECOVERY_KEY_MIN_LEN = 12
RECOVERY_KEY_MAX_LEN = 128


def engine_recovery_ready() -> bool:
    return RECOVERY_KEY_MIN_LEN >= 8