"""Engine 13 completion tests."""

from __future__ import annotations

from core.engine13 import ENGINE13_STEPS, engine13_complete, engine13_no_ai_enforced
from core.reaction_policy import SIGNAL_PROTOCOL_REACTION


def test_legacy_llm_removed():
    assert engine13_no_ai_enforced() is True


def test_reaction_protocol():
    assert SIGNAL_PROTOCOL_REACTION == "signal_v1_reaction"


def test_engine13_complete():
    assert len(ENGINE13_STEPS) == 10
    assert engine13_complete() is True