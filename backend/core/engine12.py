"""Engine 12 completion registry — premium UX features."""

from __future__ import annotations

from core.feature_policy import engine12_features_ready

ENGINE12_STEPS = {
    "12.1": "feature_policy (disappearing bounds)",
    "12.2": "local message search (minisearch)",
    "12.3": "language detect (franc)",
    "12.4": "typing indicators",
    "12.5": "voice messages",
    "12.6": "disappearing messages",
    "12.7": "stories + polls",
    "12.8": "presence map",
    "12.9": "link previews client-side",
    "12.10": "translation hooks",
    "12.11": "feature_proof + unit tests",
    "12.12": "engine12 gate",
}


def engine12_complete() -> bool:
    return engine12_features_ready() and len(ENGINE12_STEPS) == 12