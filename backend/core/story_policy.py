"""Encrypted stories/status policy — Step 7."""

from __future__ import annotations

from typing import Any

from core.metadata_policy import scrub_payload

SIGNAL_PROTOCOL_STORY = "signal_v1_story"
STORY_MAX_PER_USER = 8


def public_story(doc: dict[str, Any]) -> dict[str, Any]:
    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    expires = doc.get("expires_at")
    if hasattr(expires, "isoformat"):
        expires = expires.isoformat()
    return scrub_payload(
        {
            "id": doc["_id"],
            "user_id": doc["user_id"],
            "ciphertext": doc["ciphertext"],
            "protocol": doc.get("protocol", SIGNAL_PROTOCOL_STORY),
            "created_at": created,
            "expires_at": expires,
        }
    )


def engine7_stories_ready() -> bool:
    return bool(SIGNAL_PROTOCOL_STORY)