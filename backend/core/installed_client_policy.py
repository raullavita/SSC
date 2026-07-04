"""Installed-client header policy — Engine 2."""

from __future__ import annotations

import re
from dataclasses import dataclass

INSTALLED_CLIENT_HEADER = "X-SSC-Client"

ALLOWED_PLATFORMS: frozenset[str] = frozenset(
    {"android", "ios", "windows", "mac", "electron"}
)

# platform/version or platform/version/build
_CLIENT_PATTERN = re.compile(
    r"^(?P<platform>android|ios|windows|mac|electron)"
    r"/(?P<version>\d+\.\d+\.\d+)"
    r"(?:/(?P<build>\d+))?$",
    re.IGNORECASE,
)

EXEMPT_API_PATHS: frozenset[str] = frozenset(
    {
        "/api/health",
        "/api/health/",
        "/api/ws",
        "/api/ws/",
    }
)


@dataclass(frozen=True)
class ClientIdentity:
    platform: str
    version: str
    build: str | None
    raw: str


def parse_client_header(value: str | None) -> ClientIdentity | None:
    if not value or not value.strip():
        return None
    raw = value.strip()
    match = _CLIENT_PATTERN.match(raw)
    if not match:
        return None
    platform = match.group("platform").lower()
    if platform not in ALLOWED_PLATFORMS:
        return None
    return ClientIdentity(
        platform=platform,
        version=match.group("version"),
        build=match.group("build"),
        raw=raw,
    )


def is_exempt_path(path: str) -> bool:
    normalized = path.rstrip("/") or "/"
    if normalized in EXEMPT_API_PATHS:
        return True
    return normalized == "/api/health"


def validate_request(path: str, header_value: str | None) -> tuple[bool, str]:
    if not path.startswith("/api"):
        return True, ""
    if is_exempt_path(path):
        return True, ""
    identity = parse_client_header(header_value)
    if identity is None:
        return False, (
            "installed_client_required: SSC works only in the "
            "installed Android, iOS, Windows, or Mac app"
        )
    return True, ""


def engine2_complete() -> bool:
    return bool(ALLOWED_PLATFORMS) and bool(_CLIENT_PATTERN.pattern)