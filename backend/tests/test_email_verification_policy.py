"""Q.36 — email verification policy tests."""
from core.email_verification_policy import (
    build_verification_url,
    email_verification_required,
    is_email_verified,
)


def test_email_verification_disabled_by_default(monkeypatch):
    monkeypatch.delenv("EMAIL_VERIFICATION_REQUIRED", raising=False)
    assert email_verification_required() is False


def test_email_verification_enabled_from_env(monkeypatch):
    monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
    assert email_verification_required() is True


def test_legacy_password_user_without_field_is_verified():
    assert is_email_verified({"auth_provider": "password"}) is True


def test_unverified_password_user_blocked():
    assert is_email_verified({"auth_provider": "password", "email_verified": False}) is False


def test_google_user_always_verified():
    assert is_email_verified({"auth_provider": "google", "email_verified": False}) is True


def test_auth_public_config_includes_passkeys(monkeypatch):
    monkeypatch.setenv("ENV", "development")
    from core.email_verification_policy import auth_public_config

    cfg = auth_public_config()
    assert "passkeys_enabled" in cfg
    assert cfg["passkeys_enabled"] is True


def test_build_verification_url_uses_hash_router(monkeypatch):
    monkeypatch.setenv("PUBLIC_APP_URL", "https://app.example.com")
    monkeypatch.setenv("PUBLIC_APP_URL_HASH_ROUTER", "true")
    url = build_verification_url("tok123")
    assert url.startswith("https://app.example.com/#/verify-email?token=")