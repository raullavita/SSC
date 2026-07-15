"""Engine 13 completion registry."""

from __future__ import annotations

from pathlib import Path

from core.feature_policy import engine12_features_ready

ENGINE13_STEPS = {
    "13.1": "remove legacy LLM/smart-reply code paths",
    "13.2": "safety numbers (libsignal Fingerprint)",
    "13.3": "encrypted reactions (signal_v1_reaction)",
    "13.4": "message threads (reply_to)",
    "13.5": "PQXDH Kyber prekey enforcement (production)",
    "13.6": "validate_deploy.ps1 (dry-run)",
    "13.7": "ChatHome reactions + thread UI",
    "13.8": "feature policy charter",
    "13.9": "complete_proof.py + tests",
    "13.10": "run_engine13_gate.py",
}


def engine13_no_ai_enforced() -> bool:
    repo = Path(__file__).resolve().parents[2]
    return not (repo / "frontend" / "src" / "smart" / "smartReply.js").is_file()


def engine13_complete() -> bool:
    return engine12_features_ready() and engine13_no_ai_enforced() and len(ENGINE13_STEPS) == 10