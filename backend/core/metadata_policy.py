"""Metadata minimization policy — Engine 4."""

from __future__ import annotations

from typing import Any

# Fields that must never appear in API responses (enforced by tests).
FORBIDDEN_RESPONSE_FIELDS: frozenset[str] = frozenset(
    {
        "email",
        "password_hash",
        "google_id",
        "sender_email",
        "sender_name",
        "peer_email",
        "peer_display_name",
        "ciphertext_preview",
        "message_preview",
    }
)

CONVERSATION_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {"id", "type", "peer_id", "updated_at", "pinned", "muted", "unread_count"}
)

MESSAGE_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {"id", "conversation_id", "sender_id", "ciphertext", "protocol", "created_at"}
)


def scrub_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Remove forbidden keys recursively from a dict (shallow)."""
    return {k: v for k, v in payload.items() if k not in FORBIDDEN_RESPONSE_FIELDS}


def public_conversation(
    doc: dict[str, Any],
    viewer_id: str,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    participants = doc.get("participants", [])
    peer = next((p for p in participants if p != viewer_id), None)
    updated = doc.get("updated_at")
    if hasattr(updated, "isoformat"):
        updated = updated.isoformat()
    out = {
        "id": doc["_id"],
        "type": doc.get("type", "direct"),
        "peer_id": peer,
        "updated_at": updated,
    }
    if meta:
        out["pinned"] = bool(meta.get("pinned"))
        out["muted"] = bool(meta.get("muted"))
        if meta.get("unread_count") is not None:
            out["unread_count"] = int(meta["unread_count"])
    return scrub_payload(out)


def public_message(doc: dict[str, Any]) -> dict[str, Any]:
    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    return scrub_payload(
        {
            "id": doc["_id"],
            "conversation_id": doc["conversation_id"],
            "sender_id": doc["sender_id"],
            "ciphertext": doc["ciphertext"],
            "protocol": doc.get("protocol", "placeholder"),
            "created_at": created,
        }
    )


def engine4_metadata_policy_ready() -> bool:
    return bool(FORBIDDEN_RESPONSE_FIELDS) and bool(CONVERSATION_PUBLIC_FIELDS)