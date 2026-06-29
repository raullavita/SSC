import pytest

from core.recovery_key_policy import (
    RECOVERY_CODE_COUNT,
    format_recovery_code,
    generate_recovery_codes,
    normalize_recovery_code,
    recovery_secret_from_codes,
    sanitize_user_recovery_fields,
)


def test_generate_recovery_codes_count_and_format():
    codes = generate_recovery_codes()
    assert len(codes) == RECOVERY_CODE_COUNT
    for code in codes:
        assert len(code) == 8
        assert code == code.upper()


def test_normalize_recovery_code_strips_dashes():
    assert normalize_recovery_code("abcd-ef12") == "ABCDEF12"


def test_format_recovery_code():
    assert format_recovery_code("ABCDEF12") == "ABCD-EF12"


def test_recovery_secret_from_codes():
    codes = ["ABCD1234"] * RECOVERY_CODE_COUNT
    secret = recovery_secret_from_codes(codes)
    assert len(secret) == RECOVERY_CODE_COUNT * 8


def test_recovery_secret_rejects_wrong_count():
    with pytest.raises(ValueError):
        recovery_secret_from_codes(["ABCD1234"])


def test_sanitize_user_recovery_fields():
    user = {
        "user_id": "u_1",
        "recovery_key_hash": "hash",
        "recovery_encrypted_private_key": "enc",
        "recovery_pk_salt": "salt",
        "recovery_created_at": "2026-01-01",
    }
    out = sanitize_user_recovery_fields(user)
    assert out["recovery_enabled"] is True
    assert "recovery_key_hash" not in out
    assert "recovery_encrypted_private_key" not in out