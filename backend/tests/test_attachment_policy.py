"""Attachment protocol policy — signal_v1_attachment."""

from __future__ import annotations

from core.attachment_policy import SIGNAL_PROTOCOL_ATTACHMENT, engine8_attachments_ready


def test_attachment_protocol_constant():
    assert SIGNAL_PROTOCOL_ATTACHMENT == "signal_v1_attachment"


def test_engine8_attachments_ready():
    assert engine8_attachments_ready() is True