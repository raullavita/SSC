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
        "participants",
        "last_active",
    }
)

CONVERSATION_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {"id", "type", "peer_id", "updated_at", "pinned", "muted", "unread_count"}
)

MESSAGE_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {"id", "conversation_id", "sender_id", "ciphertext", "protocol", "created_at"}
)


def scrub_payload(payload: Any) -> Any:
    """Remove forbidden keys recursively from dict/list payloads."""
    if isinstance(payload, dict):
        return {
            k: scrub_payload(v)
            for k, v in payload.items()
            if k not in FORBIDDEN_RESPONSE_FIELDS
        }
    if isinstance(payload, list):
        return [scrub_payload(item) for item in payload]
    return payload


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


def public_message(doc: dict[str, Any], viewer_id: str | None = None) -> dict[str, Any]:
    from core.sealed_sender_policy import (  # noqa: PLC0415
        SEALED_ENVELOPE_FLAG,
        is_sealed_protocol,
        public_message_sealed,
    )

    if doc.get(SEALED_ENVELOPE_FLAG) or is_sealed_protocol(doc.get("protocol", "")):
        return scrub_payload(public_message_sealed(doc, viewer_id))

    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    out = {
        "id": doc["_id"],
        "conversation_id": doc["conversation_id"],
        "sender_id": doc["sender_id"],
        "ciphertext": doc["ciphertext"],
        "protocol": doc.get("protocol", "signal_v1"),
        "created_at": created,
    }
    if doc.get("disappearing_seconds"):
        out["disappearing_seconds"] = int(doc["disappearing_seconds"])
        exp = doc.get("expires_at")
        if hasattr(exp, "isoformat"):
            out["expires_at"] = exp.isoformat()
    if doc.get("reply_to"):
        out["reply_to"] = doc["reply_to"]
    if doc.get("message_kind"):
        out["message_kind"] = doc["message_kind"]
    return scrub_payload(out)


def engine4_metadata_policy_ready() -> bool:
    return bool(FORBIDDEN_RESPONSE_FIELDS) and bool(CONVERSATION_PUBLIC_FIELDS)