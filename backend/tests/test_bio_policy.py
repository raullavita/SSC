import pytest

from core.bio_policy import BIO_MAX_LEN, normalize_bio


def test_normalize_bio_trims_and_preserves_newlines():
    assert normalize_bio("  Hello\nworld  ") == "Hello\nworld"


def test_normalize_bio_empty_clears():
    assert normalize_bio("") is None
    assert normalize_bio("   ") is None
    assert normalize_bio(None) is None


def test_normalize_bio_collapses_excess_newlines():
    assert normalize_bio("a\n\n\n\nb") == "a\n\nb"


def test_normalize_bio_rejects_control_chars():
    with pytest.raises(ValueError, match="invalid"):
        normalize_bio("Hello\x00world")


def test_normalize_bio_max_length():
    ok = "a" * BIO_MAX_LEN
    assert normalize_bio(ok) == ok
    with pytest.raises(ValueError, match="too long"):
        normalize_bio("a" * (BIO_MAX_LEN + 1))