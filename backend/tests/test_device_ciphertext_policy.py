"""Validation tests for per-device ciphertext safeguards."""

from __future__ import annotations

import base64

from core.device_ciphertext_policy import validate_send_ciphertexts


VALID_CT = base64.b64encode(b"x" * 32).decode("ascii")


def test_device_ciphertexts_reject_too_many_targets(monkeypatch):
    monkeypatch.setattr("core.device_ciphertext_policy.MAX_DEVICE_CIPHERTEXT_TARGETS", 2)
    ok, detail = validate_send_ciphertexts(
        ciphertext=None,
        device_ciphertexts={"1": VALID_CT, "2": VALID_CT, "3": VALID_CT},
        protocol="signal_v1",
    )
    assert ok is False
    assert detail == "device_ciphertexts_too_many_targets"


def test_device_ciphertexts_reject_long_device_id(monkeypatch):
    monkeypatch.setattr("core.device_ciphertext_policy.MAX_DEVICE_ID_LENGTH", 4)
    ok, detail = validate_send_ciphertexts(
        ciphertext=None,
        device_ciphertexts={"12345": VALID_CT},
        protocol="signal_v1",
    )
    assert ok is False
    assert detail == "device_ciphertexts_device_id_too_long"


def test_device_ciphertexts_reject_total_bytes_over_limit(monkeypatch):
    monkeypatch.setattr("core.device_ciphertext_policy.MAX_TOTAL_DEVICE_CIPHERTEXT_BYTES", 40)
    ok, detail = validate_send_ciphertexts(
        ciphertext=None,
        device_ciphertexts={"1": VALID_CT, "2": VALID_CT},
        protocol="signal_v1",
    )
    assert ok is False
    assert detail == "device_ciphertexts_total_too_large"