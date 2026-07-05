"""Encrypted reactions policy — signal_v1_reaction — Engine 13."""

from __future__ import annotations

SIGNAL_PROTOCOL_REACTION = "signal_v1_reaction"
ALLOWED_REACTION_PROTOCOLS = frozenset({"signal_v1", "signal_v1_sealed", SIGNAL_PROTOCOL_REACTION})

MAX_REACTION_EMOJI_LEN = 8


def public_reaction(doc: dict, *, viewer_id: str | None = None) -> dict | None:
    if not doc:
        return None
    out = {
        "id": doc["_id"],
        "conversation_id": doc["conversation_id"],
        "target_message_id": doc["target_message_id"],
        "sender_id": doc["sender_id"],
        "ciphertext": doc["ciphertext"],
        "protocol": doc.get("protocol", SIGNAL_PROTOCOL_REACTION),
        "created_at": doc.get("created_at"),
    }
    if viewer_id and doc.get("sender_id") == viewer_id:
        out["mine"] = True
    return out


def engine13_reactions_ready() -> bool:
    return bool(SIGNAL_PROTOCOL_REACTION)