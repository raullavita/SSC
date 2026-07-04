"""Encrypted polls policy — Step 7."""

from __future__ import annotations

from typing import Any

from core.metadata_policy import scrub_payload

SIGNAL_PROTOCOL_POLL = "signal_v1_poll"
POLL_MIN_OPTIONS = 2
POLL_MAX_OPTIONS = 8


def validate_option_count(count: int) -> tuple[bool, str]:
    if count < POLL_MIN_OPTIONS or count > POLL_MAX_OPTIONS:
        return False, "poll_option_count_out_of_range"
    return True, ""


def validate_option_index(index: int, option_count: int) -> tuple[bool, str]:
    if index < 0 or index >= option_count:
        return False, "poll_option_index_invalid"
    return True, ""


def public_poll(doc: dict[str, Any]) -> dict[str, Any]:
    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    expires = doc.get("expires_at")
    if hasattr(expires, "isoformat"):
        expires = expires.isoformat()
    return scrub_payload(
        {
            "id": doc["_id"],
            "conversation_id": doc["conversation_id"],
            "message_id": doc.get("message_id"),
            "creator_id": doc["creator_id"],
            "ciphertext": doc["ciphertext"],
            "protocol": doc.get("protocol", SIGNAL_PROTOCOL_POLL),
            "option_count": int(doc.get("option_count", 0)),
            "created_at": created,
            "expires_at": expires,
        }
    )


def engine7_polls_ready() -> bool:
    return bool(SIGNAL_PROTOCOL_POLL)