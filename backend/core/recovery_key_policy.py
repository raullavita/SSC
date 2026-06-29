"""Account recovery key policy — Q.41 show-once backup codes for vault path."""
from __future__ import annotations

import secrets
from typing import List

RECOVERY_CODE_COUNT = 10
RECOVERY_CODE_HEX_LEN = 8


def generate_recovery_codes() -> List[str]:
    return [secrets.token_hex(4).upper() for _ in range(RECOVERY_CODE_COUNT)]


def normalize_recovery_code(code: str) -> str:
    return (code or "").strip().upper().replace("-", "").replace(" ", "")


def format_recovery_code(raw: str) -> str:
    norm = normalize_recovery_code(raw)
    if len(norm) != RECOVERY_CODE_HEX_LEN:
        return norm
    return f"{norm[:4]}-{norm[4:]}"


def recovery_secret_from_codes(codes: List[str]) -> str:
    normalized = [normalize_recovery_code(c) for c in codes]
    if len(normalized) != RECOVERY_CODE_COUNT:
        raise ValueError(f"Expected {RECOVERY_CODE_COUNT} recovery codes")
    if any(len(c) != RECOVERY_CODE_HEX_LEN for c in normalized):
        raise ValueError("Invalid recovery code format")
    return "".join(normalized)


def validate_recovery_codes(codes: List[str]) -> str:
    return recovery_secret_from_codes(codes)


def sanitize_user_recovery_fields(user: dict) -> dict:
    out = dict(user)
    out["recovery_enabled"] = bool(out.pop("recovery_key_hash", None))
    out.pop("recovery_encrypted_private_key", None)
    out.pop("recovery_pk_salt", None)
    return out