"""PQXDH / Kyber prekey policy — libsignal v0.96+ — Engine 13."""

from __future__ import annotations

KYBER_PREKEY_REQUIRED_PRODUCTION = True
MIN_KYBER_PREKEY_BYTES = 32


def validate_kyber_prekey(kyber: dict | None, *, production: bool) -> tuple[bool, str]:
    if not production:
        return True, ""
    if not kyber:
        return False, "kyber_prekey_required_in_production"
    pub = kyber.get("public_key") or kyber.get("publicKey") or ""
    if not pub or len(pub) < MIN_KYBER_PREKEY_BYTES:
        return False, "kyber_prekey_invalid"
    return True, ""


def engine13_pqxdh_ready() -> bool:
    return KYBER_PREKEY_REQUIRED_PRODUCTION is True