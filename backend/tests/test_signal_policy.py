"""Signal policy tests — Engine 8."""

from __future__ import annotations

import base64

from core.signal_policy import (
    SIGNAL_PROTOCOL_V1,
    engine8_signal_policy_ready,
    scrub_prekey_bundle,
    validate_signal_ciphertext,
)


def test_signal_v1_valid_ciphertext():
    raw = b"x" * 32
    b64 = base64.b64encode(raw).decode()
    ok, detail = validate_signal_ciphertext(b64, SIGNAL_PROTOCOL_V1)
    assert ok is True
    assert detail == ""


def test_signal_v1_rejects_short_payload():
    b64 = base64.b64encode(b"short").decode()
    ok, detail = validate_signal_ciphertext(b64, SIGNAL_PROTOCOL_V1)
    assert ok is False
    assert detail == "ciphertext_too_short"


def test_scrub_prekey_removes_private_fields():
    doc = scrub_prekey_bundle(
        {
            "identity_key": "abc",
            "private_key": "secret",
            "session_state": {"x": 1},
        }
    )
    assert "private_key" not in doc
    assert "session_state" not in doc
    assert doc["identity_key"] == "abc"


def test_engine8_signal_policy_ready():
    assert engine8_signal_policy_ready() is True