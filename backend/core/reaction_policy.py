"""Encrypted reactions policy — signal_v1_reaction — Engine 13."""

from __future__ import annotations

SIGNAL_PROTOCOL_REACTION = "signal_v1_reaction"
ALLOWED_REACTION_PROTOCOLS = frozenset({"signal_v1", "signal_v1_sealed", SIGNAL_PROTOCOL_REACTION})

MAX_REACTION_EMOJI_LEN = 8


def engine13_reactions_ready() -> bool:
    return bool(SIGNAL_PROTOCOL_REACTION)