"""
SSC Client Footprint Policy — machine-readable mirror of memory/CLIENT_FOOTPRINT_CHARTER.md.

Engine 3 Step 3.1: policy definition only.
Steps 3.2–3.7: enforcement code must align with this module.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

from core.e2e_policy import engine2_complete


class FootprintTier(str, Enum):
    SECRET = "secret"           # Must never survive panic
    SESSION = "session"         # Cleared on panic + logout
    PREFERENCE = "preference"     # May survive panic (non-sensitive)
    EPHEMERAL = "ephemeral"     # In-memory only; must wipe instantly on panic


class WipeEvent(str, Enum):
    PANIC = "panic"
    LOGOUT = "logout"
    STARTUP = "startup"


class GapSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class FootprintLocation:
    location_id: str
    store: str
    keys_or_content: str
    tier: FootprintTier
    panic_action: str
    logout_action: str
    engine3_step: Optional[str]
    notes: str = ""


@dataclass(frozen=True)
class FootprintGap:
    gap_id: str
    description: str
    severity: GapSeverity
    engine3_step: Optional[str]
    later_engine: Optional[str] = None
    resolved: bool = False


FOOTPRINT_LOCATIONS: Dict[str, FootprintLocation] = {
    "local_storage_jwt": FootprintLocation(
        location_id="local_storage_jwt",
        store="localStorage",
        keys_or_content="ssc_token",
        tier=FootprintTier.SECRET,
        panic_action="remove",
        logout_action="remove",
        engine3_step=None,
        notes="Cleared today; Engine 5 may move off localStorage.",
    ),
    "local_storage_push": FootprintLocation(
        location_id="local_storage_push",
        store="localStorage",
        keys_or_content="ssc_native_push_token",
        tier=FootprintTier.SESSION,
        panic_action="remove",
        logout_action="remove",
        engine3_step=None,
    ),
    "local_storage_verification": FootprintLocation(
        location_id="local_storage_verification",
        store="localStorage",
        keys_or_content="ssc_verified_v2_*",
        tier=FootprintTier.SESSION,
        panic_action="remove_all_prefix",
        logout_action="keep",
        engine3_step=None,
        notes="Cleared via localStorageFootprint.js on panic (Engine 3.4); kept on logout.",
    ),
    "local_storage_ui_lang": FootprintLocation(
        location_id="local_storage_ui_lang",
        store="localStorage",
        keys_or_content="ssc_ui_lang",
        tier=FootprintTier.PREFERENCE,
        panic_action="keep",
        logout_action="keep",
        engine3_step=None,
        notes="Non-secret UI preference.",
    ),
    "session_storage_ephemeral": FootprintLocation(
        location_id="session_storage_ephemeral",
        store="sessionStorage",
        keys_or_content="ssc_pending_call, ssc_pending_invite",
        tier=FootprintTier.SESSION,
        panic_action="clear_all",
        logout_action="clear_all",
        engine3_step=None,
        notes="panicWipe already calls sessionStorage.clear().",
    ),
    "session_storage_legacy_pk": FootprintLocation(
        location_id="session_storage_legacy_pk",
        store="sessionStorage",
        keys_or_content="ssc_pk_jwk, ssc_pk_unlocked (legacy)",
        tier=FootprintTier.SECRET,
        panic_action="purge_on_startup",
        logout_action="purge_on_startup",
        engine3_step=None,
        notes="Removed Engine 2.2; purge via vault.js on startup.",
    ),
    "react_private_key": FootprintLocation(
        location_id="react_private_key",
        store="react_state",
        keys_or_content="AuthContext.privateKey",
        tier=FootprintTier.SECRET,
        panic_action="null_immediately",
        logout_action="null_immediately",
        engine3_step=None,
        notes="Memory only — Engine 2.2.",
    ),
    "react_decrypted_messages": FootprintLocation(
        location_id="react_decrypted_messages",
        store="react_state",
        keys_or_content="ChatHome decryptedBodies, Message plaintext state",
        tier=FootprintTier.EPHEMERAL,
        panic_action="wipe_before_redirect",
        logout_action="wipe_before_redirect",
        engine3_step=None,
        notes="Cleared via memoryWipe.js on panic/logout (Engine 3.2).",
    ),
    "react_message_list": FootprintLocation(
        location_id="react_message_list",
        store="react_state",
        keys_or_content="ChatHome messages (ciphertext + metadata)",
        tier=FootprintTier.EPHEMERAL,
        panic_action="wipe_before_redirect",
        logout_action="wipe_before_redirect",
        engine3_step=None,
        notes="Cleared via memoryWipe.js on panic/logout (Engine 3.2).",
    ),
    "blob_attachment_urls": FootprintLocation(
        location_id="blob_attachment_urls",
        store="memory",
        keys_or_content="URL.createObjectURL blob URLs in Message.jsx",
        tier=FootprintTier.EPHEMERAL,
        panic_action="revoke_all",
        logout_action="revoke_all",
        engine3_step=None,
        notes="Tracked in memoryWipe.js blob registry (Engine 3.2).",
    ),
    "websocket_buffers": FootprintLocation(
        location_id="websocket_buffers",
        store="network",
        keys_or_content="ChatSocket ciphertext frames in flight",
        tier=FootprintTier.EPHEMERAL,
        panic_action="close_and_drop",
        logout_action="close_and_drop",
        engine3_step=None,
        notes="Closed via registerSocketCloser (Engine 3.2).",
    ),
    "service_worker_cache": FootprintLocation(
        location_id="service_worker_cache",
        store="service_worker",
        keys_or_content="Cache ssc-v1 (sw.js)",
        tier=FootprintTier.SESSION,
        panic_action="delete_all_caches",
        logout_action="delete_all_caches",
        engine3_step=None,
        notes="Purged via serviceWorkerCache.js + sw.js message handler (Engine 3.3).",
    ),
    "indexeddb": FootprintLocation(
        location_id="indexeddb",
        store="indexeddb",
        keys_or_content="(audit — no SSC-owned DBs; purge all at runtime)",
        tier=FootprintTier.SESSION,
        panic_action="audit_and_delete",
        logout_action="audit_and_delete",
        engine3_step=None,
        notes="Audited in indexeddb_audit.py; purged via indexedDBFootprint.js (Engine 3.5).",
    ),
}

FOOTPRINT_GAPS: List[FootprintGap] = [
    FootprintGap(
        "C1", "Decrypted message text survives in React state until page redirect", GapSeverity.CRITICAL, "3.2", resolved=True,
    ),
    FootprintGap(
        "C2", "Attachment blob URLs not centrally revoked on panic/logout", GapSeverity.HIGH, "3.2", resolved=True,
    ),
    FootprintGap(
        "C3", "No unified client wipe orchestrator (scattered AuthContext + partial clears)", GapSeverity.HIGH, "3.6", resolved=True,
    ),
    FootprintGap("C4", "Service worker caches not purged on panic", GapSeverity.MEDIUM, "3.3", resolved=True),
    FootprintGap(
        "C5", "ssc_verified_v2_* survives panic (peer metadata on device)", GapSeverity.MEDIUM, "3.4", resolved=True,
    ),
    FootprintGap("C6", "IndexedDB footprint not audited", GapSeverity.MEDIUM, "3.5", resolved=True),
    FootprintGap(
        "C7", "Client wipe runs after async server panic; memory visible during request", GapSeverity.MEDIUM, "3.6", resolved=True,
    ),
    FootprintGap(
        "C8", "JWT in localStorage (session hijack if device grabbed while logged in)", GapSeverity.HIGH, None, "5",
    ),
]

ENGINE3_STEPS: List[Tuple[str, str, bool]] = [
    ("3.1", "Client Footprint Charter", True),
    ("3.2", "Instant in-memory wipe on panic/logout", True),
    ("3.3", "Service worker cache purge", True),
    ("3.4", "localStorage panic policy (verification + SSC keys)", True),
    ("3.5", "IndexedDB audit and purge", True),
    ("3.6", "Unified panic wipe orchestrator", True),
    ("3.7", "Engine 3 test gate", True),
]

PANIC_SERVER_ENDPOINT = "/api/panic-wipe"
ORCHESTRATOR_MODULE = "frontend/src/lib/clientFootprintOrchestrator.js"
CLIENT_WIPE_PHASE_1: Tuple[str, ...] = (
    "dispatchMemoryWipe",
    "clearLocalStorageSessionSecrets",
    "purgeLegacyPrivateKeyFromSession",
    "clearSessionStorageFootprint",
)


def location_ids() -> List[str]:
    return sorted(FOOTPRINT_LOCATIONS.keys())


def open_gaps() -> List[FootprintGap]:
    return [g for g in FOOTPRINT_GAPS if not g.resolved]


def gaps_for_step(step_id: str) -> List[FootprintGap]:
    return [g for g in FOOTPRINT_GAPS if g.engine3_step == step_id]


def engine3_complete() -> bool:
    return all(done for _, _, done in ENGINE3_STEPS)