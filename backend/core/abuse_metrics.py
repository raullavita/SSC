"""Lightweight in-process abuse telemetry counters.

These counters are operational hints for health/status checks and local diagnostics.
They are intentionally aggregate-only (no raw user/IP data).
"""

from __future__ import annotations

from collections import Counter
from threading import Lock

_rate_limits: Counter[str] = Counter()
_rejections: Counter[str] = Counter()
_lock = Lock()


def record_rate_limit(scope: str) -> None:
    key = str(scope or "unknown").strip() or "unknown"
    with _lock:
        _rate_limits[key] += 1


def record_rejection(reason: str) -> None:
    key = str(reason or "unknown").strip() or "unknown"
    with _lock:
        _rejections[key] += 1


def abuse_metrics_snapshot() -> dict:
    with _lock:
        return {
            "rate_limits": dict(_rate_limits),
            "rejections": dict(_rejections),
        }


def clear_abuse_metrics_for_tests() -> None:
    with _lock:
        _rate_limits.clear()
        _rejections.clear()
