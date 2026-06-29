"""Crash reporting opt-in policy — Q.59 (Firebase Crashlytics / Sentry)."""
from __future__ import annotations

from typing import Any, Dict, Tuple

CRASH_REPORTING_OPT_IN_DEFAULT = False

# Device-local preference — not synced to server (privacy-first).
CRASH_REPORTING_STORAGE_KEY = "ssc_crash_reporting_opt_in"

PROVIDERS_BY_SURFACE: Dict[str, str] = {
    "android": "firebase_crashlytics",
    "ios": "sentry",
    "windows": "sentry",
    "mac": "sentry",
}

COLLECTED_WHEN_OPTED_IN: Tuple[str, ...] = (
    "stack_trace",
    "app_version",
    "os_version",
    "device_model",
    "crash_timestamp",
)

NEVER_COLLECTED: Tuple[str, ...] = (
    "message_plaintext",
    "private_keys",
    "passwords",
    "jwt_tokens",
    "contact_graph",
    "ciphertext_content",
)

CRASH_REPORTING_REQUIREMENTS: Tuple[str, ...] = (
    "opt_in_default_false",
    "user_toggle_in_settings",
    "no_reporting_until_opt_in",
    "scrub_secrets_before_send",
)


def crash_reporting_public_config() -> Dict[str, Any]:
    return {
        "opt_in_default": CRASH_REPORTING_OPT_IN_DEFAULT,
        "storage_key": CRASH_REPORTING_STORAGE_KEY,
        "providers": dict(PROVIDERS_BY_SURFACE),
        "collected_when_opted_in": list(COLLECTED_WHEN_OPTED_IN),
        "never_collected": list(NEVER_COLLECTED),
    }


def crash_reporting_enabled() -> bool:
    return True