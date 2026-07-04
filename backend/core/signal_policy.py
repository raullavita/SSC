"""Signal Protocol policy — Engine 8. Server stores public material only."""

from __future__ import annotations

import base64
import re
from typing import Any

SIGNAL_PROTOCOL_V1 = "signal_v1"
GROUP_SENDER_KEY_PROTOCOL = "group_sender_key_v2"
GROUP_SENDER_KEY_DIST_PROTOCOL = "group_sender_key_dist_v1"
GROUP_SENDER_KEY_DEV_PROTOCOL = "group_sender_key_dev"
LEGACY_PLACEHOLDER_PROTOCOL = "placeholder"

# Minimum ciphertext size for signal_v1 (encrypted envelope, not plaintext).
MIN_SIGNAL_CIPHERTEXT_BYTES = 16
MAX_SIGNAL_CIPHERTEXT_BYTES = 512 * 1024

PREKEY_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {
        "user_id",
        "device_id",
        "registration_id",
        "identity_key",
        "signed_prekey",
        "signed_prekey_id",
        "signed_prekey_signature",
        "prekeys",
        "kyber_prekey",
        "updated_at",
    }
)

FORBIDDEN_PREKEY_FIELDS: frozenset[str] = frozenset(
    {
        "identity_private",
        "private_key",
        "signed_prekey_private",
        "session_state",
        "root_key",
        "chain_key",
    }
)

_B64_RE = re.compile(r"^[A-Za-z0-9+/]+=*$")


def is_valid_base64(value: str) -> bool:
    if not value or not _B64_RE.match(value):
        return False
    try:
        raw = base64.b64decode(value, validate=True)
    except Exception:
        return False
    return len(raw) > 0


def validate_signal_ciphertext(ciphertext: str, protocol: str) -> tuple[bool, str]:
    if protocol == LEGACY_PLACEHOLDER_PROTOCOL:
        return True, ""
    allowed = {
        SIGNAL_PROTOCOL_V1,
        "signal_v1_sealed",
        "signal_v1_reaction",
        "signal_v1_attachment",
        GROUP_SENDER_KEY_PROTOCOL,
        GROUP_SENDER_KEY_DIST_PROTOCOL,
        GROUP_SENDER_KEY_DEV_PROTOCOL,
    }
    if protocol not in allowed:
        return False, "unsupported_protocol"
    if not is_valid_base64(ciphertext):
        return False, "invalid_ciphertext_encoding"
    raw_len = len(base64.b64decode(ciphertext))
    if raw_len < MIN_SIGNAL_CIPHERTEXT_BYTES:
        return False, "ciphertext_too_short"
    if raw_len > MAX_SIGNAL_CIPHERTEXT_BYTES:
        return False, "ciphertext_too_large"
    return True, ""


def scrub_prekey_bundle(payload: dict[str, Any]) -> dict[str, Any]:
    """Strip any private/session fields before persistence or response."""
    return {k: v for k, v in payload.items() if k not in FORBIDDEN_PREKEY_FIELDS}


def public_prekey_bundle(doc: dict[str, Any]) -> dict[str, Any]:
    out = {
        "user_id": doc.get("user_id"),
        "device_id": doc.get("device_id"),
        "registration_id": doc.get("registration_id"),
        "identity_key": doc.get("identity_key"),
        "signed_prekey": doc.get("signed_prekey"),
        "signed_prekey_id": doc.get("signed_prekey_id"),
        "signed_prekey_signature": doc.get("signed_prekey_signature"),
        "prekeys": doc.get("prekeys", []),
        "updated_at": doc.get("updated_at"),
    }
    if doc.get("kyber_prekey"):
        out["kyber_prekey"] = doc["kyber_prekey"]
    return out


def engine8_signal_policy_ready() -> bool:
    return bool(SIGNAL_PROTOCOL_V1) and bool(PREKEY_PUBLIC_FIELDS)