"""Session hardening policy constants — Engine 5."""

from __future__ import annotations

import os

SESSION_COOKIE_NAME = "ssc_session"
SESSION_JWT_TYPE = "access"
SESSION_COLLECTION = "sessions"


def allow_bearer_fallback() -> bool:
    """Native clients may send Authorization when cookies are unavailable."""
    raw = os.getenv("SSC_ALLOW_BEARER_FALLBACK", "true").strip().lower()
    return raw in ("1", "true", "yes", "on")


# Back-compat alias for imports.
ALLOW_BEARER_FALLBACK = allow_bearer_fallback()


def engine5_session_policy_ready() -> bool:
    return bool(SESSION_COOKIE_NAME) and SESSION_COLLECTION == "sessions"