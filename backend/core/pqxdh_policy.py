"""Post-quantum hybrid (PQXDH) policy — Q.55.

Kyber-1024 prekeys in X3DH bundles; libsignal SessionBuilder performs PQXDH.
No custom crypto — upstream libsignal only.
"""
from __future__ import annotations

from typing import FrozenSet, Tuple

from core.signal_policy import LIBSIGNAL_PINNED_VERSION

# libsignal 0.96+ ships Kyber prekeys and PQXDH hybrid key agreement
PQXDH_MIN_LIBSIGNAL_VERSION = "0.96.2"

PQXDH_KYBER_FIELDS: FrozenSet[str] = frozenset({
    "kyber_prekey_id",
    "kyber_prekey_public",
    "kyber_prekey_signature",
})

PQXDH_CLIENT_REQUIREMENTS: Tuple[str, ...] = (
    "generate_kyber_prekey_on_device",
    "upload_kyber_fields_in_prekey_bundle",
    "establish_session_with_kyber_via_libsignal",
    "no_custom_pq_crypto",
)

PQXDH_SERVER_REQUIREMENTS: Tuple[str, ...] = (
    "validate_kyber_fields_in_prekey_upload",
    "relay_kyber_public_material_only",
    "reject_bundles_missing_kyber",
)


def pqxdh_hybrid_enabled() -> bool:
    """PQXDH is active on installed clients at the pinned libsignal version."""
    return _version_at_least(LIBSIGNAL_PINNED_VERSION, PQXDH_MIN_LIBSIGNAL_VERSION)


def kyber_required_in_bundle() -> bool:
    """All new prekey bundles must include Kyber material."""
    return pqxdh_hybrid_enabled()


def bundle_has_kyber_fields(doc: dict) -> bool:
    return all(doc.get(field) for field in PQXDH_KYBER_FIELDS)


def _version_at_least(current: str, minimum: str) -> bool:
    def parts(v: str) -> Tuple[int, ...]:
        return tuple(int(x) for x in v.strip().split(".") if x.isdigit())

    return parts(current) >= parts(minimum)