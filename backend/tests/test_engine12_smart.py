"""Smart features tests — Engine 12."""

from __future__ import annotations

from core.engine12 import ENGINE12_STEPS, engine12_complete
from core.smart_policy import (
    DISAPPEARING_MAX_SECONDS,
    DISAPPEARING_MIN_SECONDS,
    engine12_smart_ready,
    validate_disappearing_seconds,
)


def test_disappearing_seconds_validation():
    assert validate_disappearing_seconds(None)[0] is True
    assert validate_disappearing_seconds(3600)[0] is True
    ok, detail = validate_disappearing_seconds(30)
    assert ok is False
    assert detail == "disappearing_seconds_out_of_range"


def test_disappearing_bounds():
    assert DISAPPEARING_MIN_SECONDS == 60
    assert DISAPPEARING_MAX_SECONDS == 86_400


def test_engine12_smart_ready():
    assert engine12_smart_ready() is True


def test_no_inside_ai():
    from core.smart_policy import NO_INSIDE_AI

    assert NO_INSIDE_AI is True


def test_engine12_complete():
    assert len(ENGINE12_STEPS) == 12
    assert engine12_complete() is True