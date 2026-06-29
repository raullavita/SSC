import pytest

from core.mute_duration import ALLOWED_MUTE_DURATIONS, muted_until_from_duration


def test_forever_has_no_expiry():
    assert muted_until_from_duration("forever") is None


def test_timed_durations_return_iso():
    until = muted_until_from_duration("1h")
    assert until is not None
    assert "T" in until


def test_invalid_duration_raises():
    with pytest.raises(ValueError):
        muted_until_from_duration("2d")


def test_allowed_presets():
    assert ALLOWED_MUTE_DURATIONS == frozenset({"1h", "8h", "24h", "1w", "forever"})