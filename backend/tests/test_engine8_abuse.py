"""Abuse policy tests — Engine 8."""

from __future__ import annotations

from core.abuse_policy import (
    file_magic_blocked,
    file_upload_allowed,
    engine8_abuse_policy_ready,
    mime_hint_allowed,
    spam_score_heuristic,
)


def test_blocks_pe_executable_magic():
    assert file_magic_blocked(b"MZ\x90\x00") is True


def test_allows_text_payload():
    assert file_magic_blocked(b"hello world") is False


def test_spam_score_detects_links():
    assert spam_score_heuristic("visit https://spam.example now") >= 2


def test_engine8_abuse_ready():
    assert engine8_abuse_policy_ready() is True


def test_mime_allowlist_accepts_images_audio_pdf():
    assert mime_hint_allowed("image/png") is True
    assert mime_hint_allowed("audio/ogg") is True
    assert mime_hint_allowed("application/pdf") is True


def test_mime_allowlist_rejects_executables():
    assert mime_hint_allowed("application/x-msdownload") is False
    assert file_upload_allowed("application/x-msdownload", b"hello")[0] is False


def test_file_upload_blocks_pe_magic_even_with_image_mime():
    allowed, detail = file_upload_allowed("image/png", b"MZ\x90\x00")
    assert allowed is False
    assert detail == "file_type_blocked"


def test_file_upload_rejects_oversized_payload():
    from core.abuse_policy import MAX_FILE_BYTES

    allowed, detail = file_upload_allowed("image/png", b"x" * (MAX_FILE_BYTES + 1))
    assert allowed is False
    assert detail == "file_too_large"