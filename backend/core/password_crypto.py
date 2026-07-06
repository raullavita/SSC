"""Login password hashing — Argon2id with legacy PBKDF2 migration (Phase 3)."""

from __future__ import annotations

import hashlib
import os
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_LEGACY_PREFIX = "pbkdf2_sha256$"
_ph = PasswordHasher(
    time_cost=int(os.getenv("SSC_ARGON2_TIME_COST", "3")),
    memory_cost=int(os.getenv("SSC_ARGON2_MEMORY_COST", "65536")),
    parallelism=int(os.getenv("SSC_ARGON2_PARALLELISM", "4")),
    hash_len=32,
    salt_len=16,
)


def _active_pepper() -> str:
    return os.getenv("SSC_PASSWORD_PEPPER", "")


def _legacy_peppers() -> list[str]:
    raw = os.getenv("SSC_PASSWORD_PEPPER_LEGACY", "")
    if not raw.strip():
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def _material(password: str, pepper: str) -> str:
    return f"{pepper}{password}" if pepper else password


def hash_password(password: str) -> str:
    return _ph.hash(_material(password, _active_pepper()))


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith(_LEGACY_PREFIX):
        return _verify_legacy_pbkdf2(password, stored_hash)
    peppers = [_active_pepper(), *_legacy_peppers(), ""]
    seen: set[str] = set()
    for pepper in peppers:
        if pepper in seen:
            continue
        seen.add(pepper)
        try:
            if _ph.verify(stored_hash, _material(password, pepper)):
                return True
        except VerifyMismatchError:
            continue
    return False


def needs_rehash(stored_hash: str) -> bool:
    if stored_hash.startswith(_LEGACY_PREFIX):
        return True
    return _ph.check_needs_rehash(stored_hash)


def _verify_legacy_pbkdf2(password: str, stored: str) -> bool:
    try:
        body = stored.removeprefix(_LEGACY_PREFIX)
        salt, digest_hex = body.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
        return secrets.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def legacy_pbkdf2_hash(password: str) -> str:
    """Test helper — matches pre-Phase-3 storage format."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"{_LEGACY_PREFIX}{salt}${digest.hex()}"