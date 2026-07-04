"""Engine 5 completion registry."""

from __future__ import annotations

from core.session_policy import engine5_session_policy_ready

ENGINE5_STEPS = {
    "5.1": "session_ttl centralized",
    "5.2": "httpOnly session cookies",
    "5.3": "token revocation + Mongo sessions",
    "5.4": "Redis session cache (production required)",
    "5.5": "no localStorage JWT on web client",
    "5.6": "panic logout revokes sessions",
    "5.7": "session_proof gate",
}


def engine5_complete() -> bool:
    return engine5_session_policy_ready() and len(ENGINE5_STEPS) == 7