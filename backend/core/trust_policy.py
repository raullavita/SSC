"""Trust policy — Step 13. Verification is client-only; server stores no trust state."""

from __future__ import annotations

TRUST_STATUSES = frozenset({"default", "verified", "changed"})
CLIENT_TRUST_STORAGE_KEY = "ssc_trust_v1"


def is_valid_trust_status(status: str) -> bool:
    return status in TRUST_STATUSES


def step13_trust_policy_ready() -> bool:
    return bool(TRUST_STATUSES) and bool(CLIENT_TRUST_STORAGE_KEY)