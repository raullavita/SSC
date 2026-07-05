"""Backup policy — Step 16. Export/restore is client-only; server stores no backup blobs."""

from __future__ import annotations

BACKUP_FORMAT = "ssc-backup"
BACKUP_VERSION = 1
BACKUP_FILE_EXTENSION = ".ssc-backup"
CLIENT_BACKUP_KEY_PREFIX = "ssc_"

FORBIDDEN_BACKUP_KEY_FRAGMENTS = frozenset(
    {
        "access_token",
        "refresh_token",
        "jwt",
    }
)


def is_backup_key_allowed(key: str) -> bool:
    if not key or not key.lower().startswith(CLIENT_BACKUP_KEY_PREFIX):
        return False
    lower = key.lower()
    return not any(fragment in lower for fragment in FORBIDDEN_BACKUP_KEY_FRAGMENTS)


def step16_backup_ready() -> bool:
    return bool(BACKUP_FORMAT) and BACKUP_VERSION >= 1 and bool(CLIENT_BACKUP_KEY_PREFIX)