"""Abuse policy tests — Engine 8."""

from __future__ import annotations

from core.abuse_policy import (
    file_magic_blocked,
    engine8_abuse_policy_ready,
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