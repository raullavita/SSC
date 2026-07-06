"""Signal policy tests — Engine 8."""

from __future__ import annotations

import base64
import json


from core import signal_policy as sp


def test_signal_v1_valid_ciphertext():
    raw = b"x" * 32
    b64 = base64.b64encode(raw).decode()
    ok, detail = sp.validate_signal_ciphertext(b64, sp.SIGNAL_PROTOCOL_V1)
    assert ok is True
    assert detail == ""


def test_signal_v1_rejects_short_payload():
    b64 = base64.b64encode(b"short").decode()
    ok, detail = sp.validate_signal_ciphertext(b64, sp.SIGNAL_PROTOCOL_V1)
    assert ok is False
    assert detail == "ciphertext_too_short"


def test_scrub_prekey_removes_private_fields():
    doc = sp.scrub_prekey_bundle(
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
    assert sp.engine8_signal_policy_ready() is True


def test_production_rejects_placeholder_protocol(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    ok, detail = sp.validate_protocol_for_env(sp.LEGACY_PLACEHOLDER_PROTOCOL)
    assert ok is False
    assert detail == "dev_crypto_protocol_forbidden_in_production"


def test_production_rejects_group_dev_protocol(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    ok, detail = sp.validate_protocol_for_env(sp.GROUP_SENDER_KEY_DEV_PROTOCOL)
    assert ok is False


def test_production_rejects_dev_envelope_ciphertext(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "production")
    payload = json.dumps({"v": 1, "type": "dev_envelope", "body": "hi", "pad": "x"})
    b64 = base64.b64encode(payload.encode()).decode()
    ok, detail = sp.validate_signal_ciphertext(b64, sp.SIGNAL_PROTOCOL_V1)
    assert ok is False
    assert detail == "dev_crypto_ciphertext_forbidden_in_production"


def test_development_allows_group_dev_protocol(monkeypatch):
    monkeypatch.setenv("SSC_ENV", "development")
    ok, detail = sp.validate_protocol_for_env(sp.GROUP_SENDER_KEY_DEV_PROTOCOL)
    assert ok is True