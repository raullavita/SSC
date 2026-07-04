"""Encrypted attachment message policy — signal_v1_attachment — Engine 8/12."""

from __future__ import annotations

SIGNAL_PROTOCOL_ATTACHMENT = "signal_v1_attachment"


def engine8_attachments_ready() -> bool:
    return bool(SIGNAL_PROTOCOL_ATTACHMENT)