"""Engine 13 completion registry — everything except inside AI."""

from __future__ import annotations

from core.deploy_policy import engine10_deploy_policy_ready
from core.pqxdh_policy import engine13_pqxdh_ready
from core.reaction_policy import engine13_reactions_ready
from core.smart_policy import NO_INSIDE_AI

ENGINE13_STEPS = {
    "13.1": "remove inside AI (Ollama/smart replies)",
    "13.2": "safety numbers (libsignal Fingerprint)",
    "13.3": "encrypted reactions (signal_v1_reaction)",
    "13.4": "message threads (reply_to)",
    "13.5": "PQXDH Kyber prekey enforcement",
    "13.6": "deploy validation script (no live push)",
    "13.7": "frontend reactions + thread UI",
    "13.8": "NO_INSIDE_AI charter",
    "13.9": "complete_proof + unit tests",
    "13.10": "engine13 gate",
}


def engine13_no_ai_enforced() -> bool:
    return NO_INSIDE_AI is True


def engine13_complete() -> bool:
    return (
        engine13_no_ai_enforced()
        and engine13_pqxdh_ready()
        and engine13_reactions_ready()
        and engine10_deploy_policy_ready()
        and len(ENGINE13_STEPS) == 10
    )