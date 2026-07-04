"""Session hardening policy constants — Engine 5."""

from __future__ import annotations

SESSION_COOKIE_NAME = "ssc_session"
SESSION_JWT_TYPE = "access"
SESSION_COLLECTION = "sessions"

# Native installed clients may still send Authorization for WS bootstrap only.
ALLOW_BEARER_FALLBACK = True


def engine5_session_policy_ready() -> bool:
    return bool(SESSION_COOKIE_NAME) and SESSION_COLLECTION == "sessions"