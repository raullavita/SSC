"""
SSC E2E Integrity Policy — machine-readable mirror of memory/E2E_INTEGRITY_CHARTER.md.

Engine 2 Step 2.1: policy definition only.
Steps 2.2–2.7: enforcement code must align with this module.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

from core.retention_policy import ENGINE1_STEPS


class E2EStatus(str, Enum):
    ENFORCED = "enforced"       # Truly E2E today
    PARTIAL = "partial"         # E2E path exists but gaps remain
    NOT_E2E = "not_e2e"         # Server sees plaintext or signaling
    DOCUMENTED = "documented"   # Known limitation; fixed in later engine


class GapSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class E2ESurface:
    name: str
    status: E2EStatus
    server_sees: str
    engine2_step: Optional[str]
    notes: str = ""
    later_engine: Optional[str] = None


@dataclass(frozen=True)
class IntegrityGap:
    gap_id: str
    description: str
    severity: GapSeverity
    engine2_step: Optional[str]
    later_engine: Optional[str] = None
    resolved: bool = False


E2E_SURFACES: Dict[str, E2ESurface] = {
    "messages": E2ESurface(
        name="messages",
        status=E2EStatus.ENFORCED,
        server_sees="ciphertext, iv, per-recipient encrypted_keys",
        engine2_step=None,
        notes="API projects keys to viewer only (Engine 1.4).",
    ),
    "files": E2ESurface(
        name="files",
        status=E2EStatus.ENFORCED,
        server_sees="opaque ciphertext bytes only (encrypted=true required)",
        engine2_step=None,
        notes="E2E-only upload/download (Engine 2.5). Auth header only (Engine 2.3).",
    ),
    "statuses": E2ESurface(
        name="statuses",
        status=E2EStatus.ENFORCED,
        server_sees="ciphertext envelope same as messages",
        engine2_step=None,
    ),
    "translation": E2ESurface(
        name="translation",
        status=E2EStatus.NOT_E2E,
        server_sees="plaintext request body when enabled",
        engine2_step=None,
        notes="Disabled by default; Engine 1.2 gate.",
    ),
    "webrtc_signaling": E2ESurface(
        name="webrtc_signaling",
        status=E2EStatus.DOCUMENTED,
        server_sees="SDP + ICE in cleartext over WebSocket",
        engine2_step=None,
        later_engine="8",
        notes="Media is P2P; signaling is server-visible.",
    ),
    "push": E2ESurface(
        name="push",
        status=E2EStatus.PARTIAL,
        server_sees="generic notification text, device tokens",
        engine2_step=None,
        notes="No message ciphertext in payloads.",
    ),
}

INTEGRITY_GAPS: List[IntegrityGap] = [
    IntegrityGap(
        "G1", "Decrypted private key in sessionStorage", GapSeverity.CRITICAL, "2.2", resolved=True,
    ),
    IntegrityGap(
        "G2", "Private key restored on refresh without password", GapSeverity.HIGH, "2.2", resolved=True,
    ),
    IntegrityGap("G3", "JWT in file download URL (?auth=)", GapSeverity.HIGH, "2.3", resolved=True),
    IntegrityGap("G4", "Plaintext file upload still accepted", GapSeverity.MEDIUM, "2.5", resolved=True),
    IntegrityGap("G5", "plaintext_length sent to server", GapSeverity.LOW, "2.4", resolved=True),
    IntegrityGap("G6", "WebRTC signaling cleartext on server", GapSeverity.HIGH, None, "8"),
    IntegrityGap("G7", "Verified badge is localStorage flag only", GapSeverity.MEDIUM, "2.6", resolved=True),
    IntegrityGap("G8", "Legacy attachment download without E2E keys", GapSeverity.MEDIUM, "2.5", resolved=True),
    IntegrityGap("G9", "No Signal Protocol / Double Ratchet", GapSeverity.HIGH, None, "8"),
]

CLIENT_KEY_STORAGE: Dict[str, str] = {
    "localStorage.ssc_token": "jwt_session",
    "localStorage.ssc_verified_v2_*": "safety_number_and_fingerprint_bound",
    "react_state.privateKey": "decrypted_key_in_memory_session_only",
}

# Removed in Engine 2.2 — purge on startup via frontend/src/lib/vault.js
LEGACY_CLIENT_KEY_STORAGE: Dict[str, str] = {
    "sessionStorage.ssc_pk_jwk": "decrypted_private_key_jwk",
    "sessionStorage.ssc_pk_unlocked": "unlock_flag",
    "localStorage.ssc_verified_*": "legacy_boolean_verified_flag",
}

ENGINE2_STEPS: List[Tuple[str, str, bool]] = [
    ("2.1", "E2E Integrity Charter", True),
    ("2.2", "Private key client storage hardening", True),
    ("2.3", "Remove JWT from file download URLs", True),
    ("2.4", "API response integrity audit", True),
    ("2.5", "Deprecate plaintext file upload", True),
    ("2.6", "Verification handshake hardening", True),
    ("2.7", "Engine 2 test gate", True),
]


def engine1_complete() -> bool:
    return all(done for _, _, done in ENGINE1_STEPS)


def engine2_complete() -> bool:
    return all(done for _, _, done in ENGINE2_STEPS)


def gaps_for_step(step_id: str) -> List[IntegrityGap]:
    return [g for g in INTEGRITY_GAPS if g.engine2_step == step_id]


def open_gaps() -> List[IntegrityGap]:
    return [g for g in INTEGRITY_GAPS if not g.resolved]


def surface_names() -> List[str]:
    return sorted(E2E_SURFACES.keys())