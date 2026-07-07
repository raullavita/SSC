"""Per-chat privacy policy — Step 14. Overrides inherit global privacy_settings."""

from __future__ import annotations

from typing import Any

from core.last_seen import default_privacy_settings
from core.smart_policy import validate_disappearing_seconds

DEFAULT_TYPING_VISIBLE = True

PRIVACY_OVERRIDE_DB_FIELDS = {
    "read_receipts": "privacy_read_receipts",
    "typing_visible": "privacy_typing_visible",
    "last_seen_visible": "privacy_last_seen_visible",
    "disappearing_seconds_default": "disappearing_seconds_default",
}


def public_conversation_privacy(meta: dict[str, Any] | None) -> dict[str, Any]:
    """Per-chat overrides only (null = inherit global default)."""
    meta = meta or {}
    out: dict[str, Any] = {}
    if "privacy_read_receipts" in meta:
        out["read_receipts"] = meta["privacy_read_receipts"]
    if "privacy_typing_visible" in meta:
        out["typing_visible"] = meta["privacy_typing_visible"]
    if "privacy_last_seen_visible" in meta:
        out["last_seen_visible"] = meta["privacy_last_seen_visible"]
    if "disappearing_seconds_default" in meta:
        out["disappearing_seconds_default"] = meta["disappearing_seconds_default"]
    return out


def effective_read_receipts(
    global_settings: dict[str, Any] | None,
    meta: dict[str, Any] | None,
) -> bool:
    meta = meta or {}
    if "privacy_read_receipts" in meta:
        return bool(meta["privacy_read_receipts"])
    settings = global_settings or default_privacy_settings()
    return bool(settings.get("read_receipts", False))


def effective_typing_visible(
    global_settings: dict[str, Any] | None,
    meta: dict[str, Any] | None,
) -> bool:
    meta = meta or {}
    if "privacy_typing_visible" in meta:
        return bool(meta["privacy_typing_visible"])
    settings = global_settings or default_privacy_settings()
    return bool(settings.get("typing_visible", DEFAULT_TYPING_VISIBLE))


def effective_last_seen_visible(
    global_settings: dict[str, Any] | None,
    meta: dict[str, Any] | None,
) -> bool:
    meta = meta or {}
    if "privacy_last_seen_visible" in meta:
        return bool(meta["privacy_last_seen_visible"])
    settings = global_settings or default_privacy_settings()
    return bool(settings.get("last_seen_visible", False))


def validate_disappearing_default(seconds: int | None) -> tuple[bool, str]:
    if seconds is None or seconds == 0:
        return True, ""
    return validate_disappearing_seconds(seconds)


def step14_conversation_privacy_ready() -> bool:
    return bool(PRIVACY_OVERRIDE_DB_FIELDS) and DEFAULT_TYPING_VISIBLE is True