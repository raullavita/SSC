"""Phase 2 security hardening — verification tests."""

from __future__ import annotations

import pytest

from core.client_version_policy import client_meets_minimum, min_client_build, min_client_version
from core.installed_client_policy import parse_client_header, validate_request
from core.recovery_crypto import (
    hash_recovery_passphrase,
    legacy_sha256_hash,
    needs_rehash,
    verify_recovery_passphrase,
)
from core.short_lived_tokens import clear_memory_tokens_for_tests, consume_token, issue_token


@pytest.fixture(autouse=True)
def _clear_token_memory():
    clear_memory_tokens_for_tests()


@pytest.mark.asyncio
async def test_short_lived_token_single_use():
    token = await issue_token("test_ns", {"user_id": "u1"}, 120)
    record = await consume_token("test_ns", token)
    assert record is not None
    assert record["user_id"] == "u1"
    assert await consume_token("test_ns", token) is None


def test_recovery_argon2id_hash_and_verify():
    stored = hash_recovery_passphrase("long-recovery-passphrase-99")
    assert stored.startswith("$argon2")
    assert verify_recovery_passphrase("long-recovery-passphrase-99", stored) is True
    assert verify_recovery_passphrase("wrong-passphrase", stored) is False
    assert needs_rehash(stored) is False


def test_recovery_legacy_sha256_migration():
    legacy = legacy_sha256_hash("legacy-key-material")
    assert verify_recovery_passphrase("legacy-key-material", legacy) is True
    assert needs_rehash(legacy) is True
    upgraded = hash_recovery_passphrase("legacy-key-material")
    assert verify_recovery_passphrase("legacy-key-material", upgraded) is True


def test_min_client_version_defaults(monkeypatch):
    monkeypatch.delenv("SSC_MIN_CLIENT_BUILD", raising=False)
    monkeypatch.delenv("SSC_MIN_CLIENT_VERSION", raising=False)
    assert min_client_version() == "0.3.1"
    assert min_client_build() == 10


def test_client_meets_minimum_current_build():
    identity = parse_client_header("electron/0.3.1/10")
    assert identity is not None
    ok, detail = client_meets_minimum(identity)
    assert ok is True
    assert detail == ""


def test_client_meets_minimum_rejects_old():
    identity = parse_client_header("android/0.1.0/1")
    assert identity is not None
    ok, detail = client_meets_minimum(identity)
    assert ok is False
    assert detail == "installed_client_outdated"


def test_validate_request_requires_native_bridge_when_enabled(monkeypatch):
    monkeypatch.setenv("SSC_REQUIRE_NATIVE_BRIDGE", "true")
    ok, detail = validate_request("/api/messages", "electron/0.3.0/8", native_bridge=None)
    assert ok is False
    assert detail == "native_bridge_required"