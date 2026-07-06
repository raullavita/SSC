"""Recovery passphrase hashing — Argon2id with legacy SHA256 migration (Phase 2)."""

from __future__ import annotations

import hashlib
import os
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_LEGACY_PREFIX = "sha256:"
_ph = PasswordHasher(
    time_cost=int(os.getenv("SSC_ARGON2_TIME_COST", "3")),
    memory_cost=int(os.getenv("SSC_ARGON2_MEMORY_COST", "65536")),
    parallelism=int(os.getenv("SSC_ARGON2_PARALLELISM", "4")),
    hash_len=32,
    salt_len=16,
)


def hash_recovery_passphrase(passphrase: str) -> str:
    pepper = os.getenv("SSC_RECOVERY_PEPPER", "")
    material = f"{pepper}{passphrase}" if pepper else passphrase
    return _ph.hash(material)


def verify_recovery_passphrase(passphrase: str, stored_hash: str) -> bool:
    if stored_hash.startswith(_LEGACY_PREFIX):
        legacy = hashlib.sha256(passphrase.encode("utf-8")).hexdigest()
        return secrets.compare_digest(legacy, stored_hash.removeprefix(_LEGACY_PREFIX))
    pepper = os.getenv("SSC_RECOVERY_PEPPER", "")
    material = f"{pepper}{passphrase}" if pepper else passphrase
    try:
        return _ph.verify(stored_hash, material)
    except VerifyMismatchError:
        return False


def needs_rehash(stored_hash: str) -> bool:
    if stored_hash.startswith(_LEGACY_PREFIX):
        return True
    return _ph.check_needs_rehash(stored_hash)


def legacy_sha256_hash(passphrase: str) -> str:
    """Test helper — matches pre-Phase-2 storage format."""
    return _LEGACY_PREFIX + hashlib.sha256(passphrase.encode("utf-8")).hexdigest()