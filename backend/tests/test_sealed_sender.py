"""Sealed sender tests — Engine 9."""

from __future__ import annotations

from core.sealed_sender_policy import (
    mark_sealed,
    public_message_sealed,
    engine9_sealed_sender_ready,
)


def test_sealed_hides_sender_from_recipient():
    doc = mark_sealed(
        {
            "_id": "m1",
            "conversation_id": "c1",
            "sender_id": "u_alice",
            "ciphertext": "abc",
            "protocol": "signal_v1_sealed",
        },
        sealed=True,
    )
    for_recipient = public_message_sealed(doc, viewer_id="u_bob")
    assert for_recipient.get("sealed") is True
    assert "sender_id" not in for_recipient

    for_sender = public_message_sealed(doc, viewer_id="u_alice")
    assert for_sender.get("sender_id") == "u_alice"


def test_engine9_sealed_ready():
    assert engine9_sealed_sender_ready() is True