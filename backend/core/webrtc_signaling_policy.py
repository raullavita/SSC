"""
WebRTC signaling policy — Engine 8.7 (G6).

1:1 SDP/ICE relayed as opaque signal_v1 ciphertext when clients upgrade.
Group calls use signal_v1 ciphertext when clients have sender keys; legacy cleartext fallback remains.
Server rejects signal_v1 envelopes that still carry cleartext sdp/candidate.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional

from core.signal_message_policy import (
    ALLOWED_GROUP_SIGNAL_MESSAGE_TYPES,
    SignalMessageValidationError,
    validate_distribution_id,
    validate_signal_ciphertext,
    validate_signal_message_type,
)

SENSITIVE_SIGNALING_TYPES = frozenset({"call-offer", "call-answer", "ice-candidate"})
CONTROL_SIGNALING_TYPES = frozenset({"call-end", "call-reject"})
GROUP_CALL_MODERATION_TYPES = frozenset({"call-raise-hand", "call-mute-all"})
ALL_SIGNALING_TYPES = SENSITIVE_SIGNALING_TYPES | CONTROL_SIGNALING_TYPES | GROUP_CALL_MODERATION_TYPES


class SignalingProtocol(str, Enum):
    LEGACY_CLEARTEXT = "legacy_cleartext"
    SIGNAL_V1 = "signal_v1"


class SignalingValidationError(ValueError):
    pass


def normalize_signaling_protocol(value: Optional[str]) -> str:
    raw = (value or SignalingProtocol.LEGACY_CLEARTEXT.value).strip().lower()
    if raw not in (SignalingProtocol.LEGACY_CLEARTEXT.value, SignalingProtocol.SIGNAL_V1.value):
        return SignalingProtocol.LEGACY_CLEARTEXT.value
    return raw


def is_sensitive_signaling_type(msg_type: Optional[str]) -> bool:
    return (msg_type or "") in SENSITIVE_SIGNALING_TYPES


def _validate_legacy_payload(msg_type: str, data: Dict[str, Any]) -> None:
    if msg_type == "ice-candidate":
        if not data.get("candidate"):
            raise SignalingValidationError("candidate required for legacy ice-candidate")
        return
    if not data.get("sdp"):
        raise SignalingValidationError(f"sdp required for legacy {msg_type}")


def _validate_signaling_message_type(data: Dict[str, Any]) -> int:
    """1:1 signaling uses whisper/prekey (2/3); group uses sender-key (7)."""
    raw_type = data.get("signal_message_type")
    if data.get("group"):
        if not isinstance(raw_type, int) or raw_type not in ALLOWED_GROUP_SIGNAL_MESSAGE_TYPES:
            raise SignalingValidationError("signal_message_type must be 7 (senderkey) for group signal_v1 signaling")
        return raw_type
    return validate_signal_message_type(raw_type)


def _validate_signal_v1_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    if data.get("sdp") or data.get("candidate"):
        raise SignalingValidationError("cleartext sdp/candidate not allowed with signal_v1 signaling")
    try:
        ciphertext = validate_signal_ciphertext(data.get("signaling_ciphertext") or "")
        message_type = _validate_signaling_message_type(data)
    except SignalMessageValidationError as exc:
        raise SignalingValidationError(str(exc)) from exc
    out: Dict[str, Any] = {
        **data,
        "signaling_protocol": SignalingProtocol.SIGNAL_V1.value,
        "signaling_ciphertext": ciphertext,
        "signal_message_type": message_type,
        "sdp": None,
        "candidate": None,
    }
    if data.get("group"):
        try:
            out["distribution_id"] = validate_distribution_id(data.get("distribution_id"))
        except SignalMessageValidationError as exc:
            raise SignalingValidationError(str(exc)) from exc
    return out


def validate_signaling_relay(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate WebRTC signaling before server relay. Returns sanitized payload."""
    msg_type = data.get("type")
    if msg_type not in ALL_SIGNALING_TYPES:
        raise SignalingValidationError(f"unsupported signaling type: {msg_type}")

    if msg_type in CONTROL_SIGNALING_TYPES:
        return data

    if msg_type in GROUP_CALL_MODERATION_TYPES:
        if not data.get("group"):
            raise SignalingValidationError(f"{msg_type} requires group=true")
        if msg_type == "call-raise-hand" and not isinstance(data.get("raised"), bool):
            raise SignalingValidationError("raised boolean required for call-raise-hand")
        return data

    proto = normalize_signaling_protocol(data.get("signaling_protocol"))
    if proto == SignalingProtocol.SIGNAL_V1.value:
        return _validate_signal_v1_payload(data)

    _validate_legacy_payload(msg_type, data)
    return {
        **data,
        "signaling_protocol": SignalingProtocol.LEGACY_CLEARTEXT.value,
    }


def server_sees_signaling_plaintext(protocol: Optional[str], *, is_group: bool) -> bool:
    """True when SDP/ICE may traverse the server in cleartext."""
    return normalize_signaling_protocol(protocol) != SignalingProtocol.SIGNAL_V1.value