"""WebRTC call signaling policy — Engine 8."""

from __future__ import annotations

from typing import Any

from core.signal_policy import SIGNAL_PROTOCOL_V1

CALL_TYPES = frozenset({"offer", "answer", "ice", "hangup"})
CALL_END_REASONS = frozenset({"ended", "declined", "missed", "busy"})
MESH_MAX_PARTICIPANTS = 8
RING_TIMEOUT_SEC = 45

CALL_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {
        "id",
        "conversation_id",
        "caller_id",
        "callee_id",
        "call_type",
        "video",
        "status",
        "created_at",
    }
)


def public_call_session(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": doc["_id"],
        "conversation_id": doc.get("conversation_id"),
        "caller_id": doc.get("caller_id"),
        "callee_id": doc.get("callee_id"),
        "call_type": doc.get("call_type", "audio"),
        "video": bool(doc.get("video")),
        "status": doc.get("status", "ringing"),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }


def validate_signaling_envelope(ciphertext: str, protocol: str) -> tuple[bool, str]:
    if protocol != SIGNAL_PROTOCOL_V1:
        return False, "signaling_must_be_signal_v1"
    if not ciphertext:
        return False, "empty_signaling_payload"
    return True, ""