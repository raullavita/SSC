"""PQXDH / Kyber prekey tests — Engine 13."""

from __future__ import annotations

from core.pqxdh_policy import engine13_pqxdh_ready, validate_kyber_prekey


def test_kyber_optional_in_dev():
    ok, _ = validate_kyber_prekey(None, production=False)
    assert ok is True


def test_kyber_required_in_production():
    ok, detail = validate_kyber_prekey(None, production=True)
    assert ok is False
    assert detail == "kyber_prekey_required_in_production"


def test_kyber_valid_in_production():
    ok, _ = validate_kyber_prekey(
        {"key_id": 1, "public_key": "a" * 40, "signature": "sig"},
        production=True,
    )
    assert ok is True


def test_engine13_pqxdh_ready():
    assert engine13_pqxdh_ready() is True