"""Encrypted file relay policy — Engine 8."""

from __future__ import annotations

from typing import Any

from core.signal_policy import SIGNAL_PROTOCOL_V1, is_valid_base64

FILE_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {
        "id",
        "owner_id",
        "conversation_id",
        "ciphertext",
        "protocol",
        "mime_hint",
        "size_bytes",
        "sha256",
        "created_at",
    }
)


def public_file(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": doc["_id"],
        "owner_id": doc.get("owner_id"),
        "conversation_id": doc.get("conversation_id"),
        "ciphertext": doc.get("ciphertext"),
        "protocol": doc.get("protocol", SIGNAL_PROTOCOL_V1),
        "mime_hint": doc.get("mime_hint", "application/octet-stream"),
        "size_bytes": doc.get("size_bytes", 0),
        "sha256": doc.get("sha256"),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }


def validate_file_ciphertext(ciphertext: str, protocol: str) -> tuple[bool, str]:
    if protocol != SIGNAL_PROTOCOL_V1:
        return False, "unsupported_file_protocol"
    if not is_valid_base64(ciphertext):
        return False, "invalid_file_encoding"
    return True, ""