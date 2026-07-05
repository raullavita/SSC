"""Generic push payloads — no message content or sender identity — Engine 4."""

from __future__ import annotations

from typing import Any

GENERIC_TITLE = "SSC"
GENERIC_BODY = "New message"
MISSED_CALL_BODY = "Missed call"


def build_generic_push(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    FCM/APNs-safe payload: title + generic body only.
    Never include sender id, conversation id, or ciphertext in notification body.
    """
    data = {"type": "generic_message", "silent_meta": "1"}
    if extra:
        # Only allow opaque routing keys, never human-readable content.
        for key in ("conversation_id", "message_id"):
            if key in extra:
                data[key] = str(extra[key])
    return {
        "title": GENERIC_TITLE,
        "body": GENERIC_BODY,
        "data": data,
    }


def build_missed_call_push(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generic missed-call push — no caller identity in notification body."""
    data = {"type": "missed_call", "silent_meta": "1"}
    if extra:
        for key in ("conversation_id", "call_id"):
            if key in extra:
                data[key] = str(extra[key])
    return {
        "title": GENERIC_TITLE,
        "body": MISSED_CALL_BODY,
        "data": data,
    }