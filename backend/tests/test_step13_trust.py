"""Step 13 — safety numbers + trust UX policy."""

from __future__ import annotations

from core.trust_policy import (
    CLIENT_TRUST_STORAGE_KEY,
    TRUST_STATUSES,
    is_valid_trust_status,
    step13_trust_policy_ready,
)


def test_trust_statuses():
    assert "verified" in TRUST_STATUSES
    assert "changed" in TRUST_STATUSES
    assert is_valid_trust_status("default")
    assert not is_valid_trust_status("unknown")


def test_client_storage_key_prefix():
    assert CLIENT_TRUST_STORAGE_KEY.startswith("ssc_")


def test_step13_ready():
    assert step13_trust_policy_ready()