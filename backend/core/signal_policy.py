"""
SSC Signal Protocol Policy — machine-readable mirror of memory/SIGNAL_PROTOCOL_CHARTER.md.

Engine 8 Step 8.1: policy definition only.
Steps 8.2–8.8: enforcement must align with this module.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

from core.session_policy import engine5_complete


class ProtocolVersion(str, Enum):
    LEGACY_RSA = "legacy_rsa"
    SIGNAL_V1 = "signal_v1"
    SIGNAL_GROUP_V1 = "signal_group_v1"
    SIGNAL_STATUS_V1 = "signal_status_v1"


class GapSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class ApprovedLibSource:
    artifact_id: str
    name: str
    url: str
    verify_hint: str
    platforms: Tuple[str, ...]


@dataclass(frozen=True)
class SignalGap:
    gap_id: str
    description: str
    severity: GapSeverity
    engine8_step: Optional[str]
    resolved: bool = False


# Official Signal Foundation sources only — see charter §4
APPROVED_LIB_SOURCES: Dict[str, ApprovedLibSource] = {
    "libsignal_repo": ApprovedLibSource(
        artifact_id="libsignal_repo",
        name="libsignal (Rust core + bindings)",
        url="https://github.com/signalapp/libsignal",
        verify_hint="GitHub org must be signalapp; license AGPL-3.0",
        platforms=("all",),
    ),
    "npm_libsignal_client": ApprovedLibSource(
        artifact_id="npm_libsignal_client",
        name="@signalapp/libsignal-client",
        url="https://www.npmjs.com/package/@signalapp/libsignal-client",
        verify_hint="npm publisher Signal; pin version in lockfile",
        platforms=("node", "web_eval"),
    ),
    "maven_libsignal_android": ApprovedLibSource(
        artifact_id="maven_libsignal_android",
        name="org.signal:libsignal-android",
        url="https://build-artifacts.signal.org/libraries/maven/",
        verify_hint="Signal Build Artifacts Maven only; not random mirrors",
        platforms=("android",),
    ),
    "maven_libsignal_client": ApprovedLibSource(
        artifact_id="maven_libsignal_client",
        name="org.signal:libsignal-client",
        url="https://build-artifacts.signal.org/libraries/maven/",
        verify_hint="Pair with libsignal-android; exclude desktop natives in APK",
        platforms=("android",),
    ),
}

FORBIDDEN_LIB_PATTERNS: Tuple[str, ...] = (
    "libsignal-protocol-javascript",
    "@privacyresearch/libsignal-protocol-typescript",
    "signal-protocol-javascript",
)

ENGINE8_STEPS: List[Tuple[str, str, bool]] = [
    ("8.1", "Signal Protocol Charter + policy", True),
    ("8.2", "Safety numbers v3 (libsignal identity keys)", True),
    ("8.3", "Prekey bundle API + official libsignal install", True),
    ("8.4", "X3DH session establishment (1:1)", True),
    ("8.5", "Double Ratchet messages (signal_v1)", True),
    ("8.6", "Legacy RSA dual-read + migration UX", True),
    ("8.7", "WebRTC signaling encrypted (G6)", True),
    ("8.8", "Engine 8 test gate + integration proof", True),
    ("8.9", "Signal 1:1 attachments (Android)", True),
    ("8.11", "Group Sender Keys (signal_group_v1)", True),
    ("8.12", "Stories Signal encryption (signal_status_v1)", True),
]

PUBLIC_PREKEY_FIELDS: frozenset[str] = frozenset({
    "identity_key_public",
    "signed_prekey_public",
    "signed_prekey_id",
    "signed_prekey_signature",
    "kyber_prekey_public",
    "kyber_prekey_id",
    "kyber_prekey_signature",
    "one_time_prekeys",
    "registration_id",
    "device_id",
    "libsignal_version",
})

LIBSIGNAL_PINNED_VERSION = "0.96.4"
LIBSIGNAL_NPM_PACKAGE = "@signalapp/libsignal-client"
LIBSIGNAL_MAVEN_GROUP = "org.signal"
LIBSIGNAL_MAVEN_ARTIFACT_ANDROID = "libsignal-android"

SECRET_SERVER_FIELDS: frozenset[str] = frozenset({
    "identity_key_private",
    "signed_prekey_private",
    "chain_key",
    "root_key",
    "ratchet_state",
    "decrypted_private_key",
})

SIGNAL_GAPS: Dict[str, SignalGap] = {
    "G9": SignalGap(
        gap_id="G9",
        description="No Signal Protocol / Double Ratchet",
        severity=GapSeverity.HIGH,
        engine8_step="8.5",
        resolved=True,
    ),
    "G6": SignalGap(
        gap_id="G6",
        description="WebRTC signaling cleartext on server",
        severity=GapSeverity.HIGH,
        engine8_step="8.7",
        resolved=True,
    ),
}

ENGINE8_V1_SCOPE: Tuple[str, ...] = (
    "1:1_direct_messages",
    "1:1_attachments",
    "safety_numbers_v3",
    "prekey_upload",
    "multi_device_linked",  # Q.51
    "sealed_sender",  # Q.52
    "key_change_warnings",  # Q.53
    "legacy_rsa_send_retired",  # Q.54
    "post_quantum_pqxdh",  # Q.55
)

ENGINE8_DEFERRED: Tuple[str, ...] = ()

# 8.10 browser WASM — retired; desktop libsignal is Engine 10 (see engine10_policy.py).
ENGINE8_10_RETIRED = True


def engine8_prerequisites_met() -> bool:
    return engine5_complete()


def engine8_step_81_complete() -> bool:
    """Step 8.1: charter + policy module exist (proof script audits files)."""
    from pathlib import Path

    repo = Path(__file__).resolve().parents[2]
    charter = repo / "memory" / "SIGNAL_PROTOCOL_CHARTER.md"
    return charter.is_file() and bool(APPROVED_LIB_SOURCES)


def engine8_complete() -> bool:
    return all(done for _, _, done in ENGINE8_STEPS)


def is_forbidden_lib_name(name: str) -> bool:
    lower = (name or "").lower()
    return any(p.lower() in lower for p in FORBIDDEN_LIB_PATTERNS)


def open_signal_gaps() -> List[SignalGap]:
    return [g for g in SIGNAL_GAPS.values() if not g.resolved]