"""Minimum installed-client version enforcement (Phase 2)."""

from __future__ import annotations

import os
import re
from typing import Protocol

from core.release_policy import RELEASE_BUILD, RELEASE_VERSION


class _ClientIdentityLike(Protocol):
    version: str
    build: str | None


def _min_version() -> str:
    return os.getenv("SSC_MIN_CLIENT_VERSION", RELEASE_VERSION)


def _min_build() -> int:
    return int(os.getenv("SSC_MIN_CLIENT_BUILD", RELEASE_BUILD))


def _version_parts() -> tuple[int, ...]:
    return tuple(int(x) for x in _min_version().split("."))


def min_client_version() -> str:
    return _min_version()


def min_client_build() -> int:
    return _min_build()


def client_meets_minimum(identity: _ClientIdentityLike) -> tuple[bool, str]:
    parts = _parse_version(identity.version)
    if parts is None:
        return False, "installed_client_version_invalid"
    min_parts = _version_parts()
    if parts < min_parts:
        return False, "installed_client_outdated"
    if parts > min_parts:
        return True, ""
    if identity.build is None:
        return False, "installed_client_build_required"
    try:
        build_num = int(identity.build)
    except ValueError:
        return False, "installed_client_build_invalid"
    if build_num < _min_build():
        return False, "installed_client_outdated"
    return True, ""


def _parse_version(value: str) -> tuple[int, ...] | None:
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)$", value.strip())
    if not match:
        return None
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))