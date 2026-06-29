"""
Signal migration policy — Engine 8.6 dual-read window.

Clients must decrypt both legacy_rsa and signal_v1 during migration.
Server stores protocol field; omits field on pre-8.5 rows (= legacy_rsa).
"""
from __future__ import annotations

from typing import FrozenSet, Optional, Tuple

from core.signal_policy import ProtocolVersion

DUAL_READ_PROTOCOLS: FrozenSet[str] = frozenset({
    ProtocolVersion.LEGACY_RSA.value,
    ProtocolVersion.SIGNAL_V1.value,
    ProtocolVersion.SIGNAL_GROUP_V1.value,
    ProtocolVersion.SIGNAL_STATUS_V1.value,
})

MIGRATION_CLIENT_REQUIREMENTS: Tuple[str, ...] = (
    "decrypt_legacy_rsa_and_signal_v1",
    "label_legacy_messages_in_ui",
    "installed_clients_no_legacy_rsa_send",
    "web_browser_may_send_legacy_rsa",
    "dual_write_signal_when_both_peers_ready",
)

LEGACY_FALLBACK_REASONS: Tuple[str, ...] = (
    "web_client",
    "group_chat",
    "attachment",
    "self_no_prekeys",
    "peer_no_prekeys",
    "no_signal_session",
    "vault_required",
)


def normalize_message_protocol(value: Optional[str]) -> str:
    """Pre-8.5 Mongo rows have no protocol — treat as legacy_rsa."""
    raw = (value or ProtocolVersion.LEGACY_RSA.value).strip().lower()
    if raw not in DUAL_READ_PROTOCOLS:
        return ProtocolVersion.LEGACY_RSA.value
    return raw


def dual_read_active() -> bool:
    return True


def is_legacy_protocol(protocol: Optional[str]) -> bool:
    return normalize_message_protocol(protocol) == ProtocolVersion.LEGACY_RSA.value


def is_signal_protocol(protocol: Optional[str]) -> bool:
    return normalize_message_protocol(protocol) == ProtocolVersion.SIGNAL_V1.value