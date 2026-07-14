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
    {
        "id",
        "type",
        "peer_id",
        "group_id",
        "updated_at",
        "pinned",
        "muted",
        "unread_count",
        "privacy",
    }
)

MESSAGE_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {
        "id",
        "conversation_id",
        "sender_id",
        "ciphertext",
        "protocol",
        "created_at",
        "target_device_id",
    }
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
    if doc.get("group_id") is not None:
        out["group_id"] = doc["group_id"]
    if meta:
        out["pinned"] = bool(meta.get("pinned"))
        out["muted"] = bool(meta.get("muted"))
        if meta.get("unread_count") is not None:
            out["unread_count"] = int(meta["unread_count"])
        privacy = _public_privacy_from_meta(meta)
        if privacy:
            out["privacy"] = privacy
    return scrub_payload(out)


def _public_privacy_from_meta(meta: dict[str, Any]) -> dict[str, Any]:
    from core.conversation_privacy_policy import public_conversation_privacy  # noqa: PLC0415

    return public_conversation_privacy(meta)


def public_message(
    doc: dict[str, Any],
    viewer_id: str | None = None,
    viewer_device_id: str | None = None,
) -> dict[str, Any]:
    from core.device_ciphertext_policy import resolve_viewer_ciphertext  # noqa: PLC0415
    from core.message_lifecycle_policy import is_hidden_for_viewer, is_tombstone  # noqa: PLC0415
    from core.sealed_sender_policy import (  # noqa: PLC0415
        SEALED_ENVELOPE_FLAG,
        is_sealed_protocol,
        public_message_sealed,
    )

    if is_hidden_for_viewer(doc, viewer_id):
        return {}

    if doc.get(SEALED_ENVELOPE_FLAG) or is_sealed_protocol(doc.get("protocol", "")):
        out = public_message_sealed(doc, viewer_id)
        return scrub_payload(_attach_lifecycle_fields(out, doc))

    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    ciphertext = resolve_viewer_ciphertext(
        doc,
        viewer_id=viewer_id,
        viewer_device_id=viewer_device_id,
    )
    out = {
        "id": doc["_id"],
        "conversation_id": doc["conversation_id"],
        "sender_id": doc["sender_id"],
        "ciphertext": ciphertext,
        "protocol": doc.get("protocol", "signal_v1"),
        "created_at": created,
    }
    device_map = doc.get("device_ciphertexts") or {}
    if isinstance(device_map, dict) and device_map:
        if viewer_device_id and viewer_device_id in device_map:
            out["device_ciphertexts"] = {viewer_device_id: device_map[viewer_device_id]}
            out["target_device_id"] = viewer_device_id
        else:
            out["device_ciphertexts"] = device_map
    if is_tombstone(doc):
        out["message_kind"] = "deleted"
        out.pop("ciphertext", None)
        deleted = doc.get("deleted_at")
        if hasattr(deleted, "isoformat"):
            out["deleted_at"] = deleted.isoformat()
        return scrub_payload(out)
    if doc.get("disappearing_seconds"):
        out["disappearing_seconds"] = int(doc["disappearing_seconds"])
        exp = doc.get("expires_at")
        if hasattr(exp, "isoformat"):
            out["expires_at"] = exp.isoformat()
    if doc.get("reply_to"):
        out["reply_to"] = doc["reply_to"]
    if doc.get("message_kind"):
        out["message_kind"] = doc["message_kind"]
    if doc.get("poll_id"):
        out["poll_id"] = doc["poll_id"]
    return scrub_payload(_attach_lifecycle_fields(out, doc))


def _attach_lifecycle_fields(out: dict[str, Any], doc: dict[str, Any]) -> dict[str, Any]:
    edited = doc.get("edited_at")
    if hasattr(edited, "isoformat"):
        out["edited_at"] = edited.isoformat()
    if doc.get("forwarded_from"):
        out["forwarded_from"] = doc["forwarded_from"]
    if doc.get("disappearing_seconds"):
        out["disappearing_seconds"] = int(doc["disappearing_seconds"])
        exp = doc.get("expires_at")
        if hasattr(exp, "isoformat"):
            out["expires_at"] = exp.isoformat()
    if doc.get("reply_to"):
        out["reply_to"] = doc["reply_to"]
    if doc.get("message_kind"):
        out["message_kind"] = doc["message_kind"]
    if doc.get("poll_id"):
        out["poll_id"] = doc["poll_id"]
    return out


def engine4_metadata_policy_ready() -> bool:
    return bool(FORBIDDEN_RESPONSE_FIELDS) and bool(CONVERSATION_PUBLIC_FIELDS)