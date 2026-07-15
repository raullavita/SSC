"""Feature policy — disappearing messages bounds (Engine 12)."""

from __future__ import annotations

DISAPPEARING_MIN_SECONDS = 60
DISAPPEARING_MAX_SECONDS = 86_400
TYPING_TTL_SECONDS = 8


def validate_disappearing_seconds(seconds: int | None) -> tuple[bool, str]:
    if seconds is None:
        return True, ""
    if seconds < DISAPPEARING_MIN_SECONDS or seconds > DISAPPEARING_MAX_SECONDS:
        return False, "disappearing_seconds_out_of_range"
    return True, ""


def engine12_features_ready() -> bool:
    return bool(DISAPPEARING_MIN_SECONDS) and bool(DISAPPEARING_MAX_SECONDS)