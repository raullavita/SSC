"""Per-user ephemeral retention — Q.5 picker (1h–30d, default 24h)."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence

from core.retention import DEFAULT_RETENTION_HOURS

ALLOWED_RETENTION_HOURS: Sequence[int] = (1, 2, 4, 8, 24, 168, 720)


def normalize_user_retention_hours(value: Any) -> int:
    try:
        hours = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("retention_hours must be an integer") from exc
    if hours not in ALLOWED_RETENTION_HOURS:
        allowed = ", ".join(str(h) for h in ALLOWED_RETENTION_HOURS)
        raise ValueError(f"retention_hours must be one of: {allowed}")
    return hours


def user_retention_hours_from_doc(user: Optional[dict]) -> int:
    if not user:
        return DEFAULT_RETENTION_HOURS
    raw = user.get("retention_hours")
    if raw is None:
        return DEFAULT_RETENTION_HOURS
    try:
        return normalize_user_retention_hours(raw)
    except ValueError:
        return DEFAULT_RETENTION_HOURS


def effective_retention_hours(participant_hours: Iterable[int]) -> int:
    values = [h for h in participant_hours if isinstance(h, int) and h > 0]
    if not values:
        return DEFAULT_RETENTION_HOURS
    return min(values)


def retention_public_config() -> Dict[str, Any]:
    return {
        "hours": DEFAULT_RETENTION_HOURS,
        "default_hours": DEFAULT_RETENTION_HOURS,
        "allowed_hours": list(ALLOWED_RETENTION_HOURS),
        "per_user": True,
        "summary": (
            "Messages, files, and call logs auto-delete on a schedule you choose "
            f"(default {DEFAULT_RETENTION_HOURS} hours). Group chats use the shortest timer among members."
        ),
    }


def retention_label_hours(hours: int) -> str:
    if hours == 168:
        return "7d"
    if hours == 720:
        return "30d"
    return f"{hours}h"