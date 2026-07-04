"""Engine 12 completion registry — premium UX, no inside AI."""

from __future__ import annotations

from core.smart_policy import NO_INSIDE_AI, engine12_smart_ready

ENGINE12_STEPS = {
    "12.1": "smart_policy + OSS provider registry",
    "12.2": "ephemeral typing indicators (WebSocket)",
    "12.3": "disappearing messages (per-message TTL)",
    "12.4": "smart config API",
    "12.5": "minisearch local encrypted search index",
    "12.6": "franc language detect + auto-translate",
    "12.7": "no inside AI policy (no Ollama/LLM)",
    "12.8": "voice messages (MediaRecorder + E2EE file)",
    "12.9": "ChatHome UX upgrade (search, typing)",
    "12.10": "presence badges in conversation list",
    "12.11": "smart_proof + unit tests",
    "12.12": "run_engine12_gate.py",
}


def engine12_complete() -> bool:
    return engine12_smart_ready() and NO_INSIDE_AI and len(ENGINE12_STEPS) == 12