"""Encrypted cloud backup — server stores ciphertext blob only (MongoDB)."""

from __future__ import annotations

MAX_CLOUD_BACKUP_BYTES = 5_000_000


def cloud_backup_ready() -> bool:
    return MAX_CLOUD_BACKUP_BYTES > 0