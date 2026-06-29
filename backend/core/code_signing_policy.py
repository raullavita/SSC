"""Q.61 — Desktop code signing policy (Windows Authenticode + Mac notarize)."""
from __future__ import annotations

import os
from typing import Any, Dict, Tuple

# Founder enables after certs are purchased and wired (TASK P.8 / Q.61).
WIN_AUTHENTICODE_ENV = "SSC_WIN_CODE_SIGNING_ENABLED"
MAC_NOTARIZE_ENV = "SSC_MAC_NOTARIZE_ENABLED"
WIN_VERIFY_UPDATES_ENV = "SSC_WIN_VERIFY_UPDATE_SIGNATURE"

WINDOWS_SIGNING_ENV_VARS: Tuple[str, ...] = (
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "WIN_CSC_LINK",
    "WIN_CSC_KEY_PASSWORD",
)

MAC_SIGNING_ENV_VARS: Tuple[str, ...] = (
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "CSC_NAME",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
)

CODE_SIGNING_REQUIREMENTS: Tuple[str, ...] = (
    "windows_authenticode_nsis",
    "mac_hardened_runtime",
    "mac_notarize_after_sign",
    "verify_windows_updates_when_signed",
)


def _env_flag(name: str) -> bool:
    return (os.environ.get(name) or "").strip().lower() in ("1", "true", "yes", "on")


def code_signing_public_config() -> Dict[str, Any]:
    win_on = _env_flag(WIN_AUTHENTICODE_ENV)
    mac_on = _env_flag(MAC_NOTARIZE_ENV)
    return {
        "windows": {
            "authenticode_enabled": win_on,
            "smartscreen_unsigned_warning": not win_on,
            "verify_update_signature": _env_flag(WIN_VERIFY_UPDATES_ENV) or win_on,
        },
        "mac": {
            "notarize_enabled": mac_on,
            "gatekeeper_unsigned_warning": not mac_on,
        },
        "requirements": list(CODE_SIGNING_REQUIREMENTS),
        "founder_setup": "scripts/CODE_SIGNING_SETUP.txt",
    }


def signing_env_documentation() -> Dict[str, Tuple[str, ...]]:
    return {
        "windows": WINDOWS_SIGNING_ENV_VARS,
        "mac": MAC_SIGNING_ENV_VARS,
    }