"""Signal prekey bundle validation — Engine 8.3. Public material only on server."""
from __future__ import annotations

import base64
import re
from typing import Any, Dict, List, Optional, Tuple

from core.signal_policy import PUBLIC_PREKEY_FIELDS, SECRET_SERVER_FIELDS
from core.x3dh_policy import KYBER_PUBLIC_MAX_BYTES, KYBER_PUBLIC_MIN_BYTES, KYBER_SIGNATURE_BYTES

MAX_ONE_TIME_PREKEYS = 100
MAX_PREKEY_ID = 16777215
MIN_REGISTRATION_ID = 1
MAX_REGISTRATION_ID = 16380

_B64_RE = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")


class PrekeyValidationError(ValueError):
    pass


def _decode_b64(field: str, value: str, min_len: int, max_len: int) -> bytes:
    if not value or not isinstance(value, str):
        raise PrekeyValidationError(f"{field} required")
    raw = value.strip()
    if len(raw) > 4096 or not _B64_RE.match(raw):
        raise PrekeyValidationError(f"{field} invalid base64")
    try:
        data = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise PrekeyValidationError(f"{field} invalid base64") from exc
    if not (min_len <= len(data) <= max_len):
        raise PrekeyValidationError(f"{field} invalid length")
    return data


def validate_identity_public(b64_value: str) -> str:
    data = _decode_b64("identity_key_public", b64_value, 32, 33)
    if len(data) == 33 and data[0] != 0x05:
        raise PrekeyValidationError("identity_key_public bad type byte")
    return b64_value.strip()


def validate_prekey_public(b64_value: str, field: str = "prekey_public") -> str:
    data = _decode_b64(field, b64_value, 32, 33)
    if len(data) == 33 and data[0] not in (0x05, 0x01):
        raise PrekeyValidationError(f"{field} bad type byte")
    return b64_value.strip()


def validate_signature(b64_value: str, field: str = "signed_prekey_signature") -> str:
    _decode_b64(field, b64_value, 64, 64)
    return b64_value.strip()


def validate_kyber_public(b64_value: str, field: str = "kyber_prekey_public") -> str:
    _decode_b64(field, b64_value, KYBER_PUBLIC_MIN_BYTES, KYBER_PUBLIC_MAX_BYTES)
    return b64_value.strip()


def validate_kyber_signature(b64_value: str) -> str:
    _decode_b64("kyber_prekey_signature", b64_value, KYBER_SIGNATURE_BYTES, KYBER_SIGNATURE_BYTES)
    return b64_value.strip()


def validate_one_time_prekeys(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not items:
        raise PrekeyValidationError("one_time_prekeys required")
    if len(items) > MAX_ONE_TIME_PREKEYS:
        raise PrekeyValidationError("too many one_time_prekeys")
    seen: set[int] = set()
    out: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            raise PrekeyValidationError("one_time_prekeys entry must be object")
        pid = item.get("prekey_id")
        pub = item.get("public")
        if not isinstance(pid, int) or pid < 0 or pid > MAX_PREKEY_ID:
            raise PrekeyValidationError("prekey_id out of range")
        if pid in seen:
            raise PrekeyValidationError("duplicate prekey_id")
        seen.add(pid)
        out.append({"prekey_id": pid, "public": validate_prekey_public(str(pub), "one_time_prekey.public")})
    return out


def sanitize_bundle_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Reject secret fields; return public bundle document for Mongo."""
    for forbidden in SECRET_SERVER_FIELDS:
        if forbidden in payload:
            raise PrekeyValidationError(f"forbidden field: {forbidden}")

    registration_id = payload.get("registration_id")
    if not isinstance(registration_id, int) or not (MIN_REGISTRATION_ID <= registration_id <= MAX_REGISTRATION_ID):
        raise PrekeyValidationError("registration_id out of range")

    signed_prekey_id = payload.get("signed_prekey_id")
    if not isinstance(signed_prekey_id, int) or signed_prekey_id < 0 or signed_prekey_id > MAX_PREKEY_ID:
        raise PrekeyValidationError("signed_prekey_id out of range")

    one_time = payload.get("one_time_prekeys")
    if not isinstance(one_time, list):
        raise PrekeyValidationError("one_time_prekeys must be a list")

    kyber_prekey_id = payload.get("kyber_prekey_id")
    if not isinstance(kyber_prekey_id, int) or kyber_prekey_id < 0 or kyber_prekey_id > MAX_PREKEY_ID:
        raise PrekeyValidationError("kyber_prekey_id out of range")

    doc = {
        "registration_id": registration_id,
        "device_id": int(payload.get("device_id") or 1),
        "identity_key_public": validate_identity_public(str(payload.get("identity_key_public", ""))),
        "signed_prekey_id": signed_prekey_id,
        "signed_prekey_public": validate_prekey_public(str(payload.get("signed_prekey_public", "")), "signed_prekey_public"),
        "signed_prekey_signature": validate_signature(str(payload.get("signed_prekey_signature", ""))),
        "kyber_prekey_id": kyber_prekey_id,
        "kyber_prekey_public": validate_kyber_public(str(payload.get("kyber_prekey_public", ""))),
        "kyber_prekey_signature": validate_kyber_signature(str(payload.get("kyber_prekey_signature", ""))),
        "one_time_prekeys": validate_one_time_prekeys(one_time),
        "libsignal_version": str(payload.get("libsignal_version") or "").strip()[:32],
    }
    if doc["device_id"] < 1 or doc["device_id"] > 5:
        raise PrekeyValidationError("device_id out of range")

    missing = [k for k in PUBLIC_PREKEY_FIELDS if k not in doc and k != "one_time_prekeys"]
    if missing:
        raise PrekeyValidationError(f"missing fields: {', '.join(missing)}")

    return doc


def consume_one_time_prekey(doc: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """
    Pop the first one-time prekey for X3DH bundle handout.
    Returns (updated_doc_fields, consumed_prekey or None).
    """
    keys = list(doc.get("one_time_prekeys") or [])
    if not keys:
        return {}, None
    consumed = keys.pop(0)
    return {"one_time_prekeys": keys}, consumed


def public_bundle_response(
    doc: Dict[str, Any],
    user_id: str,
    *,
    one_time_override: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Strip internal fields for peer fetch."""
    one_time = one_time_override if one_time_override is not None else doc.get("one_time_prekeys", [])[:1]
    return {
        "user_id": user_id,
        "registration_id": doc["registration_id"],
        "device_id": doc.get("device_id", 1),
        "identity_key_public": doc["identity_key_public"],
        "signed_prekey_id": doc["signed_prekey_id"],
        "signed_prekey_public": doc["signed_prekey_public"],
        "signed_prekey_signature": doc["signed_prekey_signature"],
        "kyber_prekey_id": doc["kyber_prekey_id"],
        "kyber_prekey_public": doc["kyber_prekey_public"],
        "kyber_prekey_signature": doc["kyber_prekey_signature"],
        "one_time_prekeys": one_time,
        "libsignal_version": doc.get("libsignal_version", ""),
    }