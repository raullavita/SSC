"""Phase 3 security hardening — verification tests."""

from __future__ import annotations

import json

import pytest

from core.captcha import captcha_required, verify_captcha
from core.device_attestation import (
    build_test_attestation_token,
    verify_attestation_token,
)
from core.password_crypto import hash_password, legacy_pbkdf2_hash, needs_rehash, verify_password
from core.sfu_internal_auth import sign_sfu_request, verify_sfu_request
from core.ws_subscribe_tokens import (
    consume_subscribe_token,
    issue_subscribe_token,
    validate_topic_for_user,
    ws_subscribe_token_required,
)


@pytest.fixture(autouse=True)
def _phase3_test_env(monkeypatch):
    from core.short_lived_tokens import clear_memory_tokens_for_tests

    clear_memory_tokens_for_tests()
    monkeypatch.setenv("SSC_CAPTCHA_REQUIRED", "false")
    monkeypatch.setenv("SSC_REQUIRE_DEVICE_ATTEST", "false")
    monkeypatch.setenv("SSC_REQUIRE_WS_SUBSCRIBE_TOKEN", "true")


def test_password_argon2id_hash_and_verify():
    stored = hash_password("login-password-99")
    assert stored.startswith("$argon2")
    assert verify_password("login-password-99", stored) is True
    assert verify_password("wrong", stored) is False
    assert needs_rehash(stored) is False


def test_password_legacy_pbkdf2_migration():
    legacy = legacy_pbkdf2_hash("legacy-login")
    assert verify_password("legacy-login", legacy) is True
    assert needs_rehash(legacy) is True


@pytest.mark.asyncio
async def test_ws_subscribe_token_single_use():
    token = await issue_subscribe_token("u1", "user:u1")
    assert await consume_subscribe_token(token, "u1", "user:u1") is True
    assert await consume_subscribe_token(token, "u1", "user:u1") is False


def test_ws_subscribe_topic_validation():
    assert validate_topic_for_user("user:u1", "u1") is True
    assert validate_topic_for_user("user:u2", "u1") is False
    assert validate_topic_for_user("conversation:c1", "u1") is True


@pytest.mark.asyncio
async def test_captcha_skipped_when_not_required():
    ok, detail = await verify_captcha(None)
    assert ok is True
    assert detail == ""
    assert captcha_required() is False


def test_device_attest_disabled_by_default(monkeypatch):
    monkeypatch.setenv("SSC_REQUIRE_DEVICE_ATTEST", "false")
    ok, _ = verify_attestation_token("android", None)
    assert ok is True


def test_device_attest_test_token_in_dev(monkeypatch):
    monkeypatch.setenv("SSC_REQUIRE_DEVICE_ATTEST", "true")
    monkeypatch.setenv("SSC_ENV", "development")
    ok, _ = verify_attestation_token("android", "ssc-attest-test-v1")
    assert ok is True


def test_device_attest_hmac_token(monkeypatch):
    monkeypatch.setenv("SSC_REQUIRE_DEVICE_ATTEST", "true")
    monkeypatch.setenv("SSC_ENV", "production")
    monkeypatch.setenv("SSC_PLAY_INTEGRITY_SECRET", "play-secret-key")
    token = build_test_attestation_token("android")
    ok, detail = verify_attestation_token("android", token)
    assert ok is True
    assert detail == ""


def test_sfu_hmac_sign_and_verify():
    body = json.dumps({"room_id": "r1", "join_token": "jt"}).encode()
    headers = sign_sfu_request("POST", "/internal/rooms", body)
    lowered = {k.lower(): v for k, v in headers.items()}
    assert verify_sfu_request("POST", "/internal/rooms", body, lowered, secret=headers["X-SSC-SFU-Secret"])


def test_ws_subscribe_required_flag(monkeypatch):
    monkeypatch.setenv("SSC_REQUIRE_WS_SUBSCRIBE_TOKEN", "true")
    assert ws_subscribe_token_required() is True