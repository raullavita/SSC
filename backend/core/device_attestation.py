"""Device attestation policy — Play Integrity / DeviceCheck (Phase 3)."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time

ATTESTATION_HEADER = "X-SSC-Device-Attest"
_TEST_TOKEN = "ssc-attest-test-v1"
_DESKTOP_PLATFORMS = frozenset({"electron", "windows", "mac", "desktop"})


def require_device_attestation() -> bool:
    from config import get_settings

    default = "true" if get_settings().is_production else "false"
    raw = os.getenv("SSC_REQUIRE_DEVICE_ATTEST", default).strip().lower()
    return raw in ("1", "true", "yes", "on")


def attestation_configured() -> bool:
    return bool(
        os.getenv("SSC_PLAY_INTEGRITY_SECRET", "").strip()
        or os.getenv("SSC_DEVICECHECK_SECRET", "").strip()
        or os.getenv("SSC_DESKTOP_ATTEST_SECRET", "").strip()
    )


def _desktop_attest_secret() -> str:
    return os.getenv("SSC_DESKTOP_ATTEST_SECRET", "").strip()


def verify_attestation_token(platform: str, token: str | None) -> tuple[bool, str]:
    if not require_device_attestation():
        return True, ""

    if not token or not token.strip():
        return False, "device_attest_required"
    value = token.strip()
    plat = platform.lower()

    if value == _TEST_TOKEN and os.getenv("SSC_ENV", "").lower() != "production":
        return True, ""

    if plat == "android":
        return _verify_hmac_token(value, os.getenv("SSC_PLAY_INTEGRITY_SECRET", ""), "android")
    if plat == "ios":
        return _verify_hmac_token(value, os.getenv("SSC_DEVICECHECK_SECRET", ""), "ios")
    if plat in _DESKTOP_PLATFORMS:
        return _verify_hmac_token(value, _desktop_attest_secret(), plat)
    return False, "device_attest_platform_unknown"


def _verify_hmac_token(token: str, secret: str, platform: str) -> tuple[bool, str]:
    if not secret:
        return False, "device_attest_not_configured"
    try:
        ts_raw, sig = token.split(".", 1)
        ts = int(ts_raw)
    except ValueError:
        return False, "device_attest_malformed"
    if abs(time.time() - ts) > 300:
        return False, "device_attest_expired"
    expected = hmac.new(
        secret.encode(),
        f"{platform}:{ts}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not secrets.compare_digest(expected, sig):
        return False, "device_attest_invalid"
    return True, ""


def build_test_attestation_token(platform: str) -> str:
    """Dev/test helper — HMAC attestation when secret is set."""
    plat = platform.lower()
    if plat == "android":
        secret = os.getenv("SSC_PLAY_INTEGRITY_SECRET", "")
    elif plat == "ios":
        secret = os.getenv("SSC_DEVICECHECK_SECRET", "")
    elif plat in _DESKTOP_PLATFORMS:
        secret = _desktop_attest_secret()
    else:
        secret = ""
    if not secret:
        return _TEST_TOKEN
    ts = int(time.time())
    sig = hmac.new(
        secret.encode(),
        f"{platform}:{ts}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{ts}.{sig}"