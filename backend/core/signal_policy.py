"""Signal Protocol policy — Engine 8. Server stores public material only."""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Any

SIGNAL_PROTOCOL_V1 = "signal_v1"
GROUP_SENDER_KEY_PROTOCOL = "group_sender_key_v2"
GROUP_SENDER_KEY_DIST_PROTOCOL = "group_sender_key_dist_v1"
GROUP_SENDER_KEY_DEV_PROTOCOL = "group_sender_key_dev"
LEGACY_PLACEHOLDER_PROTOCOL = "placeholder"

DEV_CRYPTO_PROTOCOLS = frozenset(
    {
        LEGACY_PLACEHOLDER_PROTOCOL,
        GROUP_SENDER_KEY_DEV_PROTOCOL,
    }
)

DEV_CIPHERTEXT_TYPES = frozenset({"dev_envelope", "dev_file"})

# Minimum ciphertext size for signal_v1 (encrypted envelope, not plaintext).
MIN_SIGNAL_CIPHERTEXT_BYTES = 16
MAX_SIGNAL_CIPHERTEXT_BYTES = 512 * 1024

PREKEY_PUBLIC_FIELDS: frozenset[str] = frozenset(
    {
        "_id",
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


def is_production_env() -> bool:
    return os.getenv("SSC_ENV", "development") == "production"


def is_dev_ciphertext(ciphertext: str) -> bool:
    """Detect client dev-envelope JSON smuggled as signal_v1 ciphertext."""
    try:
        raw = base64.b64decode(ciphertext, validate=True)
        payload = json.loads(raw.decode("utf-8"))
        return payload.get("type") in DEV_CIPHERTEXT_TYPES
    except Exception:
        return False


def validate_protocol_for_env(protocol: str) -> tuple[bool, str]:
    if is_production_env() and protocol in DEV_CRYPTO_PROTOCOLS:
        return False, "dev_crypto_protocol_forbidden_in_production"
    return True, ""


def is_valid_base64(value: str) -> bool:
    if not value or not _B64_RE.match(value):
        return False
    try:
        raw = base64.b64decode(value, validate=True)
    except Exception:
        return False
    return len(raw) > 0


def validate_signal_ciphertext(ciphertext: str, protocol: str) -> tuple[bool, str]:
    proto_ok, proto_detail = validate_protocol_for_env(protocol)
    if not proto_ok:
        return False, proto_detail

    if protocol == LEGACY_PLACEHOLDER_PROTOCOL:
        return True, ""

    allowed = {
        SIGNAL_PROTOCOL_V1,
        "signal_v1_sealed",
        "signal_v1_reaction",
        "signal_v1_attachment",
        "signal_v1_poll",
        "signal_v1_story",
        GROUP_SENDER_KEY_PROTOCOL,
        GROUP_SENDER_KEY_DIST_PROTOCOL,
    }
    if not is_production_env():
        allowed.add(GROUP_SENDER_KEY_DEV_PROTOCOL)

    if protocol not in allowed:
        return False, "unsupported_protocol"
    if not is_valid_base64(ciphertext):
        return False, "invalid_ciphertext_encoding"
    raw_len = len(base64.b64decode(ciphertext))
    if raw_len < MIN_SIGNAL_CIPHERTEXT_BYTES:
        return False, "ciphertext_too_short"
    if raw_len > MAX_SIGNAL_CIPHERTEXT_BYTES:
        return False, "ciphertext_too_large"
    if is_production_env() and is_dev_ciphertext(ciphertext):
        return False, "dev_crypto_ciphertext_forbidden_in_production"
    return True, ""


def scrub_prekey_bundle(payload: dict[str, Any]) -> dict[str, Any]:
    """Strip any private/session fields before persistence or response."""
    return {k: v for k, v in payload.items() if k in PREKEY_PUBLIC_FIELDS}


def public_prekey_bundle(doc: dict[str, Any]) -> dict[str, Any]:
    signed_pub = doc.get("signed_prekey")
    signed_id = doc.get("signed_prekey_id")
    signed_sig = doc.get("signed_prekey_signature")
    signed_prekey: dict[str, Any] | str | None = signed_pub
    if isinstance(signed_pub, str) and signed_pub:
        signed_prekey = {
            "key_id": signed_id,
            "public_key": signed_pub,
            "signature": signed_sig,
        }
    out = {
        "user_id": doc.get("user_id"),
        "device_id": doc.get("device_id"),
        "registration_id": doc.get("registration_id"),
        "identity_key": doc.get("identity_key"),
        "signed_prekey": signed_prekey,
        "prekeys": doc.get("prekeys", []),
        "updated_at": doc.get("updated_at"),
    }
    if signed_id is not None:
        out["signed_prekey_id"] = signed_id
    if signed_sig:
        out["signed_prekey_signature"] = signed_sig
    if doc.get("kyber_prekey"):
        out["kyber_prekey"] = doc["kyber_prekey"]
    return out


def public_prekey_device_summary(doc: dict[str, Any]) -> dict[str, Any]:
    """Device metadata for peer discovery — never includes one-time prekeys."""
    prekeys = doc.get("prekeys") or []
    updated = doc.get("updated_at")
    if hasattr(updated, "isoformat"):
        updated = updated.isoformat()
    return {
        "user_id": doc.get("user_id"),
        "device_id": doc.get("device_id"),
        "registration_id": doc.get("registration_id"),
        "prekeys_remaining": len(prekeys),
        "prekeys_low": len(prekeys) < 5,
        "has_signed_prekey": bool(doc.get("signed_prekey")),
        "updated_at": updated,
    }


def engine8_signal_policy_ready() -> bool:
    return bool(SIGNAL_PROTOCOL_V1) and bool(PREKEY_PUBLIC_FIELDS)