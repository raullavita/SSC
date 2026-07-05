"""Generic push payloads — no message content — Engine 4 + P2#12 rich labels."""

from __future__ import annotations

from typing import Any

from core.push_rich_policy import merge_push_data, push_body_for_kind, sanitize_push_label

GENERIC_TITLE = "SSC"
GENERIC_BODY = "New message"
MISSED_CALL_BODY = "Missed call"


def build_generic_push(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    FCM/APNs-safe payload. Title/body never include ciphertext.
    Rich mode may use conversation_label as title when provided in extra.
    """
    kind = (extra or {}).get("kind") or "message"
    label = sanitize_push_label((extra or {}).get("conversation_label"))
    title = label or GENERIC_TITLE
    body = push_body_for_kind(str(kind))
    data = merge_push_data(
        {"type": "generic_message", "silent_meta": "1", "kind": str(kind)},
        extra,
    )
    return {"title": title, "body": body, "data": data}


def build_missed_call_push(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generic missed-call push — no caller identity in notification body."""
    label = sanitize_push_label((extra or {}).get("conversation_label"))
    title = label or GENERIC_TITLE
    data = merge_push_data({"type": "missed_call", "silent_meta": "1", "kind": "call"}, extra)
    return {"title": title, "body": MISSED_CALL_BODY, "data": data}