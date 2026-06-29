import pytest

from core.webauthn_policy import (
    is_allowed_origin,
    passkeys_enabled,
    user_id_to_bytes,
    webauthn_allowed_origins,
    webauthn_rp_id,
)


def test_passkeys_enabled_in_development(monkeypatch):
    monkeypatch.setenv("ENV", "development")
    monkeypatch.delenv("WEBAUTHN_RP_ID", raising=False)
    assert passkeys_enabled() is True
    assert webauthn_rp_id() == "localhost"


def test_passkeys_disabled_without_rp_in_production(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("WEBAUTHN_RP_ID", raising=False)
    monkeypatch.delenv("WEBAUTHN_ORIGINS", raising=False)
    monkeypatch.delenv("PUBLIC_APP_URL", raising=False)
    assert passkeys_enabled() is False


def test_custom_rp_and_origins(monkeypatch):
    monkeypatch.setenv("WEBAUTHN_RP_ID", "supersecurechat.com")
    monkeypatch.setenv("WEBAUTHN_ORIGINS", "https://supersecurechat.com,https://app.example.com")
    assert webauthn_rp_id() == "supersecurechat.com"
    assert is_allowed_origin("https://app.example.com") is True
    assert is_allowed_origin("https://evil.example.com") is False


def test_user_id_to_bytes_valid():
    assert user_id_to_bytes("u_abc123") == b"u_abc123"


def test_user_id_to_bytes_rejects_empty():
    with pytest.raises(ValueError):
        user_id_to_bytes("")