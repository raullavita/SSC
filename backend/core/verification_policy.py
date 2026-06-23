"""Verification handshake policy — Engine 2 Step 2.6. See memory/E2E_INTEGRITY_CHARTER.md §8."""
from __future__ import annotations

from typing import FrozenSet, Tuple

VERIFICATION_STORAGE_V2_PREFIX = "ssc_verified_v2_"
LEGACY_VERIFICATION_PREFIX = "ssc_verified_"
VERIFICATION_RECORD_VERSION = 1

REQUIRED_RECORD_FIELDS: FrozenSet[str] = frozenset({
    "v",
    "safety_number",
    "peer_fingerprint",
    "my_fingerprint",
    "verified_at",
})

SAFETY_NUMBER_LENGTH = 60

CLIENT_VERIFICATION_CONTROLS: Tuple[str, ...] = (
    "frontend/src/lib/verification.js",
    "frontend/src/components/VerifyHandshakeModal.jsx",
    "frontend/src/pages/ChatHome.jsx",
)