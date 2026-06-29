"""Verification handshake policy — Engine 2.6 + Engine 8.2. See memory/SIGNAL_PROTOCOL_CHARTER.md."""
from __future__ import annotations

from typing import FrozenSet, Tuple

VERIFICATION_STORAGE_V2_PREFIX = "ssc_verified_v2_"
LEGACY_VERIFICATION_PREFIX = "ssc_verified_"
VERIFICATION_RECORD_VERSION = 3

REQUIRED_RECORD_FIELDS: FrozenSet[str] = frozenset({
    "v",
    "key_type",
    "safety_number",
    "peer_identity",
    "my_identity",
    "verified_at",
})

SAFETY_NUMBER_LENGTH = 60
FINGERPRINT_ITERATIONS = 5200

IDENTITY_KEY_TYPES: Tuple[str, ...] = ("legacy_rsa", "signal_v1")

CLIENT_VERIFICATION_CONTROLS: Tuple[str, ...] = (
    "frontend/src/lib/verification.js",
    "frontend/src/lib/safetyNumber.js",
    "frontend/src/lib/identityKey.js",
    "frontend/src/lib/keyChangeWarnings.js",
    "frontend/src/components/VerifyHandshakeModal.jsx",
    "frontend/src/components/KeyChangeWarningBanner.jsx",
    "frontend/src/pages/ChatHome.jsx",
)