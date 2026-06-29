"""
X3DH session policy — Engine 8.4.

Sessions and ratchet state are client-only. Server relays public prekey bundles only.
"""
from __future__ import annotations

from typing import FrozenSet, Tuple

# Server must never persist Signal session material
FORBIDDEN_SESSION_SERVER_FIELDS: FrozenSet[str] = frozenset({
    "session_record",
    "session_state",
    "ratchet_state",
    "chain_key",
    "root_key",
    "message_keys",
})

# Kyber-1024 public material (libsignal 0.96+ PQXDH hybrid — Q.55)
KYBER_PUBLIC_MIN_BYTES = 100
KYBER_PUBLIC_MAX_BYTES = 4096
KYBER_SIGNATURE_BYTES = 64

X3DH_CLIENT_REQUIREMENTS: Tuple[str, ...] = (
    "persist_identity_and_prekeys_on_device",
    "establish_session_via_libsignal_session_builder",
    "fetch_peer_bundle_contacts_only",
    "consume_one_time_prekey_on_peer_fetch",
)

X3DH_SERVER_REQUIREMENTS: Tuple[str, ...] = (
    "relay_public_prekey_bundles_only",
    "never_store_session_records",
    "contacts_only_peer_bundle_fetch",
)


def x3dh_session_server_allowed() -> bool:
    """Server stores zero session state — always False for persistence."""
    return False


def validate_no_session_fields_on_server(payload: dict) -> None:
    """Raise ValueError if a document attempts to store session secrets."""
    found = FORBIDDEN_SESSION_SERVER_FIELDS & set(payload.keys())
    if found:
        raise ValueError(f"forbidden session fields on server: {', '.join(sorted(found))}")