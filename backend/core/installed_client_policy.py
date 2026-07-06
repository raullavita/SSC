"""Installed-client header policy — Engine 2."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from core.client_version_policy import client_meets_minimum

INSTALLED_CLIENT_HEADER = "X-SSC-Client"
NATIVE_BRIDGE_HEADER = "X-SSC-Native-Bridge"
NATIVE_BRIDGE_VALUE = "v1"

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
        "/api/auth/google/callback",
        "/api/auth/google/start",
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
    if normalized.startswith("/api/auth/google/"):
        return True
    if normalized.startswith("/api/public/"):
        return True
    return normalized == "/api/health"


def _require_native_bridge() -> bool:
    from config import get_settings

    default = "true" if get_settings().is_production else "false"
    raw = os.getenv("SSC_REQUIRE_NATIVE_BRIDGE", default).strip().lower()
    return raw in ("1", "true", "yes", "on")


def validate_request(
    path: str,
    header_value: str | None,
    *,
    native_bridge: str | None = None,
    device_attest: str | None = None,
) -> tuple[bool, str]:
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
    ok, detail = client_meets_minimum(identity)
    if not ok:
        return False, detail
    if _require_native_bridge():
        bridge = (native_bridge or "").strip()
        if bridge != NATIVE_BRIDGE_VALUE:
            return False, "native_bridge_required"
    from core.device_attestation import require_device_attestation, verify_attestation_token

    if require_device_attestation():
        ok, detail = verify_attestation_token(identity.platform, device_attest)
        if not ok:
            return False, detail
    return True, ""


def engine2_complete() -> bool:
    return bool(ALLOWED_PLATFORMS) and bool(_CLIENT_PATTERN.pattern)