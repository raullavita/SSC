"""Sealed sender policy — Engine 9. Server minimizes sender metadata exposure."""

from __future__ import annotations

from typing import Any

SEALED_ENVELOPE_FLAG = "sealed_sender"
SEALED_PROTOCOL_SUFFIX = "_sealed"


def is_sealed_protocol(protocol: str) -> bool:
    return protocol.endswith(SEALED_PROTOCOL_SUFFIX) or protocol == "signal_v1_sealed"


def mark_sealed(doc: dict[str, Any], sealed: bool) -> dict[str, Any]:
    if sealed:
        doc[SEALED_ENVELOPE_FLAG] = True
    return doc


def public_message_sealed(doc: dict[str, Any], viewer_id: str | None) -> dict[str, Any]:
    """Strip sender_id from sealed messages for non-sender viewers."""
    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()

    out: dict[str, Any] = {
        "id": doc["_id"],
        "conversation_id": doc["conversation_id"],
        "ciphertext": doc["ciphertext"],
        "protocol": doc.get("protocol", "signal_v1"),
        "created_at": created,
    }

    sealed = bool(doc.get(SEALED_ENVELOPE_FLAG)) or is_sealed_protocol(out["protocol"])
    if sealed:
        out["sealed"] = True
        if viewer_id and viewer_id == doc.get("sender_id"):
            out["sender_id"] = viewer_id
    else:
        out["sender_id"] = doc.get("sender_id")

    return out


def engine9_sealed_sender_ready() -> bool:
    return bool(SEALED_ENVELOPE_FLAG)