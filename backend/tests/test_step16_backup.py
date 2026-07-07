"""Step 16 — encrypted client backup/export policy."""

from __future__ import annotations

from core.backup_policy import (
    BACKUP_FILE_EXTENSION,
    BACKUP_FORMAT,
    BACKUP_VERSION,
    CLIENT_BACKUP_KEY_PREFIX,
    FORBIDDEN_BACKUP_KEY_FRAGMENTS,
    is_backup_key_allowed,
    step16_backup_ready,
)


def test_backup_constants():
    assert BACKUP_FORMAT == "ssc-backup"
    assert BACKUP_VERSION == 1
    assert BACKUP_FILE_EXTENSION == ".ssc-backup"
    assert CLIENT_BACKUP_KEY_PREFIX == "ssc_"
    assert "accesstoken" in FORBIDDEN_BACKUP_KEY_FRAGMENTS


def test_is_backup_key_allowed():
    assert is_backup_key_allowed("ssc_trust_v1")
    assert is_backup_key_allowed("ssc_auto_translate")
    assert not is_backup_key_allowed("ssc_access_token")
    assert not is_backup_key_allowed("ssc_accessToken")
    assert not is_backup_key_allowed("ssc_refresh-token")
    assert not is_backup_key_allowed("access_token")
    assert not is_backup_key_allowed("other_key")


def test_step16_backup_ready():
    assert step16_backup_ready()