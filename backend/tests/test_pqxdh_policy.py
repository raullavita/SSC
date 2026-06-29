"""Q.55 — post-quantum hybrid (PQXDH) policy tests."""
import pytest

from core.pqxdh_policy import (
    PQXDH_KYBER_FIELDS,
    PQXDH_CLIENT_REQUIREMENTS,
    PQXDH_SERVER_REQUIREMENTS,
    bundle_has_kyber_fields,
    kyber_required_in_bundle,
    pqxdh_hybrid_enabled,
)
from core.signal_policy import ENGINE8_DEFERRED, ENGINE8_V1_SCOPE, LIBSIGNAL_PINNED_VERSION


def test_pqxdh_enabled_at_pinned_version():
    assert pqxdh_hybrid_enabled() is True
    assert kyber_required_in_bundle() is True
    assert LIBSIGNAL_PINNED_VERSION >= "0.96.4"


def test_kyber_fields_required():
    assert len(PQXDH_KYBER_FIELDS) == 3
    assert bundle_has_kyber_fields({
        "kyber_prekey_id": 1,
        "kyber_prekey_public": "abc",
        "kyber_prekey_signature": "sig",
    })
    assert not bundle_has_kyber_fields({"kyber_prekey_id": 1})


def test_pqxdh_requirements_documented():
    assert len(PQXDH_CLIENT_REQUIREMENTS) >= 3
    assert len(PQXDH_SERVER_REQUIREMENTS) >= 2
    assert "no_custom_pq_crypto" in PQXDH_CLIENT_REQUIREMENTS


def test_post_quantum_in_scope_not_deferred():
    assert "post_quantum_pqxdh" in ENGINE8_V1_SCOPE
    assert "post_quantum_pqxdh" not in ENGINE8_DEFERRED


def test_version_compare():
    from core.pqxdh_policy import _version_at_least

    assert _version_at_least("0.96.4", "0.96.2") is True
    assert _version_at_least("0.96.1", "0.96.2") is False