"""Timed mute duration presets — Q.44."""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from core.utils import iso, now_utc

ALLOWED_MUTE_DURATIONS = frozenset({"1h", "8h", "24h", "1w", "forever"})

_DURATION_HOURS = {
    "1h": 1,
    "8h": 8,
    "24h": 24,
    "1w": 168,
}


def muted_until_from_duration(duration: str) -> Optional[str]:
    """Return ISO expiry for timed mutes; None means mute until manually cleared."""
    if duration not in ALLOWED_MUTE_DURATIONS:
        raise ValueError("invalid_mute_duration")
    if duration == "forever":
        return None
    hours = _DURATION_HOURS[duration]
    return iso(now_utc() + timedelta(hours=hours))