"""Security scan policy — Q.56 (OWASP ZAP CI + security smoke).

Baseline ZAP runs against the ephemeral CI API (not production).
Smoke checks assert public surfaces never leak secrets and auth boundaries hold.
"""
from __future__ import annotations

from typing import Any, Dict, FrozenSet, Mapping, Tuple

ZAP_WORKFLOW_PATH = ".github/workflows/zap.yml"
ZAP_RULES_PATH = ".zap/rules.tsv"
SECURITY_SMOKE_SCRIPT = "backend/scripts/security_smoke.py"

# Substrings that must never appear in public JSON responses (case-insensitive).
FORBIDDEN_PUBLIC_LEAKS: FrozenSet[str] = frozenset({
    "jwt_secret",
    "mongo_url",
    "contact_graph_pepper",
    "vapid_private",
    "turn_credential",
    "turnstile_secret",
    "firebase_service_account",
    "google_client_secret",
    "encrypted_private_key",
    "totp_secret",
    "totp_pending_secret",
    "private_key",
    "password_hash",
})

REQUIRED_SECURITY_HEADERS: Tuple[str, ...] = (
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
)

# Sample routes that must reject unauthenticated access.
PROTECTED_ROUTE_SAMPLES: Tuple[str, ...] = (
    "/api/contacts",
    "/api/auth/me",
    "/api/messages",
    "/api/conversations",
)

PUBLIC_SMOKE_PATHS: Tuple[str, ...] = (
    "/api/",
    "/api/health",
    "/api/config",
)

SECURITY_SCAN_REQUIREMENTS: Tuple[str, ...] = (
    "zap_baseline_workflow_in_ci",
    "security_smoke_script",
    "public_config_no_secrets",
    "protected_routes_require_auth",
    "security_headers_on_api",
)


def response_leaks_secrets(body_text: str) -> Tuple[str, ...]:
    """Return forbidden substrings found in a response body."""
    lower = (body_text or "").lower()
    return tuple(s for s in FORBIDDEN_PUBLIC_LEAKS if s in lower)


def headers_include_security_baselines(headers: Mapping[str, str]) -> Tuple[str, ...]:
    """Return required security headers that are missing (case-insensitive keys)."""
    normalized = {k.lower(): v for k, v in headers.items()}
    return tuple(h for h in REQUIRED_SECURITY_HEADERS if h not in normalized)


def is_unauthorized_status(status_code: int) -> bool:
    return status_code in (401, 403)


def audit_public_payload(payload: Any) -> Tuple[str, ...]:
    """Deep scan a JSON-serializable payload for forbidden leak substrings."""
    import json

    try:
        text = json.dumps(payload, default=str)
    except TypeError:
        text = str(payload)
    return response_leaks_secrets(text)


def security_scan_enabled() -> bool:
    return True