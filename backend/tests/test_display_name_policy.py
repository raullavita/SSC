import pytest

from core.display_name_policy import DISPLAY_NAME_MAX_LEN, normalize_display_name


def test_normalize_display_name_trims_and_collapses():
    assert normalize_display_name("  Alex   Kim  ") == "Alex Kim"


def test_normalize_display_name_empty_clears():
    assert normalize_display_name("") is None
    assert normalize_display_name("   ") is None
    assert normalize_display_name(None) is None


def test_normalize_display_name_rejects_at_sign():
    with pytest.raises(ValueError, match="@"):
        normalize_display_name("Alex@home")


def test_normalize_display_name_rejects_control_chars():
    with pytest.raises(ValueError, match="invalid"):
        normalize_display_name("Alex\x00Kim")


def test_normalize_display_name_max_length():
    ok = "a" * DISPLAY_NAME_MAX_LEN
    assert normalize_display_name(ok) == ok
    with pytest.raises(ValueError, match="too long"):
        normalize_display_name("a" * (DISPLAY_NAME_MAX_LEN + 1))