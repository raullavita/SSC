"""Signal Protocol proof — Engine 8 Step 8.1 / 8.8. See memory/SIGNAL_PROTOCOL_CHARTER.md."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple

from core.signal_policy import (
    APPROVED_LIB_SOURCES,
    ENGINE8_STEPS,
    FORBIDDEN_LIB_PATTERNS,
    SIGNAL_GAPS,
    engine5_complete,
    engine8_complete,
    engine8_step_81_complete,
    is_forbidden_lib_name,
    open_signal_gaps,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]

ENGINE8_UNIT_MODULES: Tuple[str, ...] = (
    "tests/test_signal_policy.py",
    "tests/test_engine8_gate.py",
    "tests/test_prekey_bundle.py",
    "tests/test_x3dh_policy.py",
    "tests/test_signal_message_policy.py",
    "tests/test_migration_policy.py",
    "tests/test_webrtc_signaling_policy.py",
    "tests/test_pqxdh_policy.py",
    "tests/test_legacy_rsa_policy.py",
)

ENGINE8_INTEGRATION_MODULES: Tuple[str, ...] = (
    "tests/test_engine8_integration.py",
)

ENGINE8_SCRIPTS: Tuple[str, ...] = (
    "scripts/run_engine8_gate.py",
    "scripts/signal_proof.py",
)

ENFORCEMENT_PATHS_81: Tuple[str, ...] = (
    "memory/SIGNAL_PROTOCOL_CHARTER.md",
    "backend/core/signal_policy.py",
)

ENFORCEMENT_PATHS_83: Tuple[str, ...] = (
    "backend/core/prekey_bundle.py",
    "backend/routers/keys.py",
    "frontend/src/lib/signal/prekeys.js",
    "frontend/src/lib/signal/nativeLibsignal.js",
    "frontend/android/app/src/main/java/chat/ssc/secure/plugins/SscLibsignalPlugin.java",
    "frontend/android/app/build.gradle",
)

ENFORCEMENT_PATHS_84: Tuple[str, ...] = (
    "backend/core/x3dh_policy.py",
    "frontend/src/lib/signal/x3dh.js",
    "frontend/android/app/src/main/java/chat/ssc/secure/plugins/SscSignalStore.java",
)

ENFORCEMENT_PATHS_85: Tuple[str, ...] = (
    "backend/core/signal_message_policy.py",
    "frontend/src/lib/signal/messages.js",
)

ENFORCEMENT_PATHS_86: Tuple[str, ...] = (
    "backend/core/migration_policy.py",
    "backend/core/legacy_rsa_policy.py",
    "frontend/src/lib/signal/migration.js",
    "frontend/src/lib/signal/legacyRsaPolicy.js",
    "frontend/src/components/EncryptionModeBadge.jsx",
)

ENFORCEMENT_PATHS_87: Tuple[str, ...] = (
    "backend/core/webrtc_signaling_policy.py",
    "frontend/src/lib/signal/webrtcSignaling.js",
)

ENFORCEMENT_PATHS_89: Tuple[str, ...] = (
    "frontend/src/lib/signal/attachments.js",
)

ENFORCEMENT_PATHS_811: Tuple[str, ...] = (
    "frontend/src/lib/signal/groupMessages.js",
)

ENFORCEMENT_PATHS_812: Tuple[str, ...] = (
    "backend/core/signal_status_policy.py",
    "frontend/src/lib/signal/statuses.js",
)

ENFORCEMENT_PATHS_855: Tuple[str, ...] = (
    "backend/core/pqxdh_policy.py",
    "frontend/src/lib/signal/pqxdhPolicy.js",
)

ENFORCEMENT_PATHS_82: Tuple[str, ...] = (
    "frontend/src/lib/safetyNumber.js",
    "frontend/src/lib/identityKey.js",
    "frontend/src/lib/verification.js",
    "frontend/src/lib/keyChangeWarnings.js",
    "frontend/src/components/VerifyHandshakeModal.jsx",
    "frontend/src/components/KeyChangeWarningBanner.jsx",
    "backend/core/verification_policy.py",
)

ENGINE8_ALL_ENFORCEMENT_PATHS: Tuple[str, ...] = (
    *ENFORCEMENT_PATHS_81,
    *ENFORCEMENT_PATHS_82,
    *ENFORCEMENT_PATHS_83,
    *ENFORCEMENT_PATHS_84,
    *ENFORCEMENT_PATHS_85,
    *ENFORCEMENT_PATHS_86,
    *ENFORCEMENT_PATHS_87,
    *ENFORCEMENT_PATHS_89,
    *ENFORCEMENT_PATHS_811,
    *ENFORCEMENT_PATHS_812,
    *ENFORCEMENT_PATHS_855,
)


@dataclass
class ProofCheck:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class SignalProofReport:
    checks: List[ProofCheck] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks],
        }


def _check_engine5_prerequisite() -> ProofCheck:
    ok = engine5_complete()
    return ProofCheck(
        name="engine5_prerequisite",
        passed=ok,
        detail="Engines 1–5 complete" if ok else "Engine 5 must be complete before Engine 8",
    )


def _check_charter_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_81 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="charter_and_policy_files",
        passed=ok,
        detail="charter + signal_policy.py present" if ok else f"missing: {missing}",
    )


def _check_approved_sources() -> ProofCheck:
    required = ("libsignal_repo", "npm_libsignal_client", "maven_libsignal_android")
    ok = all(k in APPROVED_LIB_SOURCES for k in required)
    urls = [APPROVED_LIB_SOURCES[k].url for k in required if k in APPROVED_LIB_SOURCES]
    return ProofCheck(
        name="approved_lib_sources",
        passed=ok,
        detail=f"official sources documented: {len(urls)}" if ok else "missing approved source entries",
    )


def _check_forbidden_patterns() -> ProofCheck:
    ok = len(FORBIDDEN_LIB_PATTERNS) >= 2 and is_forbidden_lib_name("libsignal-protocol-javascript")
    return ProofCheck(
        name="forbidden_lib_guard",
        passed=ok,
        detail="community/archived libs blocked by policy" if ok else "forbidden list incomplete",
    )


def _check_step_81() -> ProofCheck:
    ok = engine8_step_81_complete()
    return ProofCheck(
        name="engine8_step_81",
        passed=ok,
        detail="8.1 charter + policy complete" if ok else "8.1 incomplete",
    )


def _check_open_gaps_documented() -> ProofCheck:
    ok = "G9" in SIGNAL_GAPS and "G6" in SIGNAL_GAPS
    return ProofCheck(
        name="g6_g9_documented",
        passed=ok,
        detail="G6 WebRTC + G9 ratchet tracked" if ok else "gap registry incomplete",
    )


def _check_engine8_steps_registry() -> ProofCheck:
    ids = [s[0] for s in ENGINE8_STEPS]
    ok = ids == ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.11", "8.12"]
    done_81 = any(s[0] == "8.1" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_steps_registry",
        passed=ok and done_81,
        detail="8.1–8.11 registered; 8.1 marked done" if ok and done_81 else "step registry mismatch",
    )


def _check_step_82_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_82 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_82_files",
        passed=ok,
        detail="8.2 client verification modules present" if ok else f"missing: {missing}",
    )


def _check_no_external_qr_api() -> ProofCheck:
    modal = (REPO_ROOT / "frontend/src/components/VerifyHandshakeModal.jsx").read_text(encoding="utf-8")
    ok = (
        "api.qrserver.com" not in modal
        and "QRCode.toDataURL" not in modal
        and "verify-safety-number" in modal
        and "verify-paste-input" in modal
    )
    return ProofCheck(
        name="local_qr_generation",
        passed=ok,
        detail="text-only safety number verify (Q.53 — no QR)" if ok else "verify modal must not use external or local QR",
    )


def _check_step_82() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS

    ok = any(s[0] == "8.2" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_82",
        passed=ok,
        detail="8.2 safety numbers v3 complete" if ok else "8.2 not marked done",
    )


def run_signal_proof_step_81() -> SignalProofReport:
    checks = [
        _check_engine5_prerequisite(),
        _check_charter_files(),
        _check_approved_sources(),
        _check_forbidden_patterns(),
        _check_step_81(),
        _check_open_gaps_documented(),
        _check_engine8_steps_registry(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_83() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS, LIBSIGNAL_PINNED_VERSION

    ok = any(s[0] == "8.3" and s[2] for s in ENGINE8_STEPS)
    gradle = (REPO_ROOT / "frontend/android/app/build.gradle").read_text(encoding="utf-8")
    pinned = f"libsignal-android:{LIBSIGNAL_PINNED_VERSION}" in gradle
    return ProofCheck(
        name="engine8_step_83",
        passed=ok and pinned,
        detail=f"8.3 prekey API + libsignal {LIBSIGNAL_PINNED_VERSION} pinned" if ok and pinned else "8.3 incomplete",
    )


def _check_step_83_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_83 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_83_files",
        passed=ok,
        detail="8.3 prekey + native plugin files present" if ok else f"missing: {missing}",
    )


def run_signal_proof_step_82() -> SignalProofReport:
    checks = run_signal_proof_step_81().checks + [
        _check_step_82_files(),
        _check_no_external_qr_api(),
        _check_step_82(),
    ]
    return SignalProofReport(checks=checks)


def run_signal_proof_step_83() -> SignalProofReport:
    checks = run_signal_proof_step_82().checks + [
        _check_step_83_files(),
        _check_step_83(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_84_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_84 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_84_files",
        passed=ok,
        detail="8.4 X3DH policy + client session modules present" if ok else f"missing: {missing}",
    )


def _check_step_84_plugin() -> ProofCheck:
    plugin = (REPO_ROOT / "frontend/android/app/src/main/java/chat/ssc/secure/plugins/SscLibsignalPlugin.java").read_text(
        encoding="utf-8"
    )
    ok = "establishSession" in plugin and "hasSession" in plugin and "KyberPreKeyRecord" in plugin
    return ProofCheck(
        name="engine8_step_84_plugin",
        passed=ok,
        detail="8.4 Capacitor plugin exposes X3DH session methods" if ok else "establishSession/hasSession missing",
    )


def _check_step_84_no_server_sessions() -> ProofCheck:
    from core.x3dh_policy import x3dh_session_server_allowed

    keys = (REPO_ROOT / "backend/routers/keys.py").read_text(encoding="utf-8")
    ok = x3dh_session_server_allowed() is False and "session_record" not in keys.lower()
    return ProofCheck(
        name="engine8_step_84_server_policy",
        passed=ok,
        detail="server never persists X3DH session state" if ok else "server session persistence risk",
    )


def _check_step_84() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS

    ok = any(s[0] == "8.4" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_84",
        passed=ok,
        detail="8.4 X3DH session establishment complete" if ok else "8.4 not marked done",
    )


def run_signal_proof_step_84() -> SignalProofReport:
    checks = run_signal_proof_step_83().checks + [
        _check_step_84_files(),
        _check_step_84_plugin(),
        _check_step_84_no_server_sessions(),
        _check_step_84(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_85_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_85 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_85_files",
        passed=ok,
        detail="8.5 signal_v1 message policy + client modules present" if ok else f"missing: {missing}",
    )


def _check_step_85_plugin() -> ProofCheck:
    plugin = (REPO_ROOT / "frontend/android/app/src/main/java/chat/ssc/secure/plugins/SscLibsignalPlugin.java").read_text(
        encoding="utf-8"
    )
    ok = "encryptSignalMessage" in plugin and "decryptSignalMessage" in plugin and "SessionCipher" in plugin
    return ProofCheck(
        name="engine8_step_85_plugin",
        passed=ok,
        detail="8.5 Double Ratchet encrypt/decrypt in Capacitor plugin" if ok else "SessionCipher methods missing",
    )


def _check_step_85_router() -> ProofCheck:
    router = (REPO_ROOT / "backend/routers/messages.py").read_text(encoding="utf-8")
    ok = "signal_message_policy" in router and "validate_send_payload" in router
    return ProofCheck(
        name="engine8_step_85_router",
        passed=ok,
        detail="8.5 messages router accepts signal_v1" if ok else "messages router not wired",
    )


def _check_step_85_g9() -> ProofCheck:
    from core.signal_policy import SIGNAL_GAPS

    g9 = SIGNAL_GAPS.get("G9")
    ok = g9 is not None and g9.resolved is True
    return ProofCheck(
        name="engine8_step_85_g9",
        passed=ok,
        detail="G9 Double Ratchet gap closed" if ok else "G9 still open",
    )


def _check_step_85() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS

    ok = any(s[0] == "8.5" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_85",
        passed=ok,
        detail="8.5 Double Ratchet messages complete" if ok else "8.5 not marked done",
    )


def run_signal_proof_step_85() -> SignalProofReport:
    checks = run_signal_proof_step_84().checks + [
        _check_step_85_files(),
        _check_step_85_plugin(),
        _check_step_85_router(),
        _check_step_85_g9(),
        _check_step_85(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_86_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_86 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_86_files",
        passed=ok,
        detail="8.6 migration policy + dual-read UX modules present" if ok else f"missing: {missing}",
    )


def _check_step_86_dual_read() -> ProofCheck:
    migration = (REPO_ROOT / "frontend/src/lib/signal/migration.js").read_text(encoding="utf-8")
    message = (REPO_ROOT / "frontend/src/components/Message.jsx").read_text(encoding="utf-8")
    ok = "decryptMessageBody" in migration and "decryptMessageBody" in message
    return ProofCheck(
        name="engine8_step_86_dual_read",
        passed=ok,
        detail="8.6 unified dual-read decrypt wired in Message" if ok else "dual-read decrypt missing",
    )


def _check_step_86_migration_labels() -> ProofCheck:
    message = (REPO_ROOT / "frontend/src/components/Message.jsx").read_text(encoding="utf-8")
    chat = (REPO_ROOT / "frontend/src/pages/ChatHome.jsx").read_text(encoding="utf-8")
    # TASK A — no protocol labels in messages; no legacy/upgrade banners in chat.
    ok = "SIG" not in message and "RSA" not in message
    ok = ok and "encryption-hint-banner" not in chat and "vaultLocked" not in chat
    return ProofCheck(
        name="engine8_step_86_labels",
        passed=ok,
        detail="8.6 invisible crypto UX (no protocol labels/banners)" if ok else "migration UI labels still exposed",
    )


def _check_step_86_api_default() -> ProofCheck:
    api = (REPO_ROOT / "backend/core/api_integrity.py").read_text(encoding="utf-8")
    ok = "normalize_message_protocol" in api
    return ProofCheck(
        name="engine8_step_86_api_default",
        passed=ok,
        detail="8.6 pre-8.5 messages default to legacy_rsa" if ok else "protocol normalization missing",
    )


def _check_step_86_legacy_send_retired() -> ProofCheck:
    policy = (REPO_ROOT / "backend/core/legacy_rsa_policy.py").read_text(encoding="utf-8")
    client = (REPO_ROOT / "frontend/src/lib/signal/legacyRsaPolicy.js").read_text(encoding="utf-8")
    messages = (REPO_ROOT / "backend/routers/messages.py").read_text(encoding="utf-8")
    stories = (REPO_ROOT / "frontend/src/components/Stories.jsx").read_text(encoding="utf-8")
    ok = (
        "reject_legacy_rsa_send_for_installed" in policy
        and "maySendLegacyRsa" in client
        and "reject_legacy_rsa_send_for_installed" in messages
        and "maySendLegacyRsa" in stories
    )
    return ProofCheck(
        name="engine8_step_86_legacy_send_retired",
        passed=ok,
        detail="Q.54 installed clients decrypt-only for legacy RSA" if ok else "legacy RSA send retirement incomplete",
    )


def _check_step_86() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS

    ok = any(s[0] == "8.6" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_86",
        passed=ok,
        detail="8.6 dual-read + migration UX complete" if ok else "8.6 not marked done",
    )


def run_signal_proof_step_86() -> SignalProofReport:
    checks = run_signal_proof_step_85().checks + [
        _check_step_86_files(),
        _check_step_86_dual_read(),
        _check_step_86_migration_labels(),
        _check_step_86_api_default(),
        _check_step_86_legacy_send_retired(),
        _check_step_86(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_87_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_87 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_87_files",
        passed=ok,
        detail="8.7 WebRTC signaling policy + client modules present" if ok else f"missing: {missing}",
    )


def _check_step_87_ws_validation() -> ProofCheck:
    ws = (REPO_ROOT / "backend/routers/ws_handler.py").read_text(encoding="utf-8")
    ok = "validate_signaling_relay" in ws and "SignalingValidationError" in ws
    return ProofCheck(
        name="engine8_step_87_ws_validation",
        passed=ok,
        detail="8.7 server validates signaling before relay" if ok else "ws_handler missing signaling validation",
    )


def _check_step_87_client_encrypt() -> ProofCheck:
    call = (REPO_ROOT / "frontend/src/components/CallModal.jsx").read_text(encoding="utf-8")
    signaling = (REPO_ROOT / "frontend/src/lib/signal/webrtcSignaling.js").read_text(encoding="utf-8")
    ok = "sendSignaling" in call and "packOutgoingSignaling" in signaling and "unpackIncomingSignaling" in signaling
    return ProofCheck(
        name="engine8_step_87_client_encrypt",
        passed=ok,
        detail="8.7 CallModal uses ratchet-wrapped signaling" if ok else "client signaling encryption missing",
    )


def _check_step_87_g6_closed() -> ProofCheck:
    ok = SIGNAL_GAPS.get("G6") is not None and SIGNAL_GAPS["G6"].resolved is True
    return ProofCheck(
        name="engine8_step_87_g6",
        passed=ok,
        detail="G6 WebRTC signaling gap closed" if ok else "G6 still open",
    )


def _check_step_87() -> ProofCheck:
    ok = any(s[0] == "8.7" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_87",
        passed=ok,
        detail="8.7 WebRTC signaling E2E complete" if ok else "8.7 not marked done",
    )


def run_signal_proof_step_87() -> SignalProofReport:
    checks = run_signal_proof_step_86().checks + [
        _check_step_87_files(),
        _check_step_87_ws_validation(),
        _check_step_87_client_encrypt(),
        _check_step_87_g6_closed(),
        _check_step_87(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_88_integration_module() -> ProofCheck:
    missing = [m for m in ENGINE8_INTEGRATION_MODULES if not (BACKEND_ROOT / m).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_88_integration",
        passed=ok,
        detail="8.8 live-server integration module present" if ok else f"missing: {missing}",
    )


def _check_step_88_gate_scripts() -> ProofCheck:
    missing = [s for s in ENGINE8_SCRIPTS if not (BACKEND_ROOT / s).is_file()]
    gate = (BACKEND_ROOT / "scripts" / "run_engine8_gate.py").read_text(encoding="utf-8")
    ok = not missing and "ENGINE8_INTEGRATION_MODULES" in gate and "run_signal_proof" in gate
    return ProofCheck(
        name="engine8_step_88_gate_scripts",
        passed=ok,
        detail="8.8 gate runner + integration wiring present" if ok else "gate scripts incomplete",
    )


def _check_step_88_enforcement_rollup() -> ProofCheck:
    missing = [p for p in ENGINE8_ALL_ENFORCEMENT_PATHS if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_88_enforcement_rollup",
        passed=ok,
        detail="8.8 all Engine 8 enforcement paths present" if ok else f"missing: {missing}",
    )


def _check_step_88_gaps_closed() -> ProofCheck:
    open_ids = {g.gap_id for g in open_signal_gaps()}
    ok = not open_ids
    return ProofCheck(
        name="engine8_step_88_gaps_closed",
        passed=ok,
        detail="G6 + G9 closed; no open Signal gaps" if ok else f"open: {sorted(open_ids)}",
    )


def _check_step_88_complete_helper() -> ProofCheck:
    ok = engine8_complete()
    return ProofCheck(
        name="engine8_complete_helper",
        passed=ok,
        detail="engine8_complete() is True" if ok else "not all ENGINE8_STEPS marked done",
    )


def _check_step_88_charter_gate_docs() -> ProofCheck:
    charter = REPO_ROOT / "memory" / "SIGNAL_PROTOCOL_CHARTER.md"
    if not charter.is_file():
        return ProofCheck(name="engine8_charter_gate_docs", passed=False, detail="charter missing")
    text = charter.read_text(encoding="utf-8")
    ok = "**8.8**" in text and "run_engine8_gate.py" in text
    return ProofCheck(
        name="engine8_charter_gate_docs",
        passed=ok,
        detail="charter documents step 8.8 gate" if ok else "charter missing 8.8 / run_engine8_gate.py",
    )


def _check_step_88() -> ProofCheck:
    ok = any(s[0] == "8.8" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_88",
        passed=ok,
        detail="8.8 Engine 8 test gate + integration proof complete" if ok else "8.8 not marked done",
    )


def run_signal_proof_step_88() -> SignalProofReport:
    checks = run_signal_proof_step_87().checks + [
        _check_step_88_integration_module(),
        _check_step_88_gate_scripts(),
        _check_step_88_enforcement_rollup(),
        _check_step_88_gaps_closed(),
        _check_step_88_complete_helper(),
        _check_step_88_charter_gate_docs(),
        _check_step_88(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_89_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_89 if not (REPO_ROOT / p).is_file()]
    ok = not missing
    return ProofCheck(
        name="engine8_step_89_files",
        passed=ok,
        detail="8.9 Signal attachment modules present" if ok else f"missing: {missing}",
    )


def _check_step_89_migration() -> ProofCheck:
    migration = (REPO_ROOT / "frontend/src/lib/signal/migration.js").read_text(encoding="utf-8")
    ok = "shouldSendWithSignal" in migration and "isSignalAttachmentEnvelope" in migration
    return ProofCheck(
        name="engine8_step_89_migration",
        passed=ok,
        detail="8.9 attachments enabled in migration send path" if ok else "attachment migration missing",
    )


def _check_step_89() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS

    ok = any(s[0] == "8.9" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_89",
        passed=ok,
        detail="8.9 Signal 1:1 attachments complete" if ok else "8.9 not marked done",
    )


def run_signal_proof_step_89() -> SignalProofReport:
    checks = run_signal_proof_step_88().checks + [
        _check_step_89_files(),
        _check_step_89_migration(),
        _check_step_89(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_811_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_811 if not (REPO_ROOT / p).is_file()]
    plugin = (REPO_ROOT / "frontend/android/app/src/main/java/chat/ssc/secure/plugins/SscLibsignalPlugin.java").read_text(encoding="utf-8")
    ok = not missing and "encryptGroupMessage" in plugin and "GroupCipher" in plugin
    return ProofCheck(
        name="engine8_step_811_files",
        passed=ok,
        detail="8.11 group sender key modules present" if ok else "group sender key modules missing",
    )


def _check_step_811_policy() -> ProofCheck:
    policy = (REPO_ROOT / "backend/core/signal_message_policy.py").read_text(encoding="utf-8")
    ok = "signal_group_v1" in policy and "ALLOWED_GROUP_SIGNAL_MESSAGE_TYPES" in policy
    return ProofCheck(
        name="engine8_step_811_policy",
        passed=ok,
        detail="8.11 signal_group_v1 backend policy present" if ok else "group policy missing",
    )


def _check_step_811() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS

    ok = any(s[0] == "8.11" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_811",
        passed=ok,
        detail="8.11 Group Sender Keys complete" if ok else "8.11 not marked done",
    )


def run_signal_proof_step_811() -> SignalProofReport:
    checks = run_signal_proof_step_89().checks + [
        _check_step_811_files(),
        _check_step_811_policy(),
        _check_step_811(),
    ]
    return SignalProofReport(checks=checks)


def _check_step_812_files() -> ProofCheck:
    missing = [p for p in ENFORCEMENT_PATHS_812 if not (REPO_ROOT / p).is_file()]
    stories = (REPO_ROOT / "frontend/src/components/Stories.jsx").read_text(encoding="utf-8")
    ok = not missing and "encryptStatusText" in stories and "decryptStatusText" in stories
    return ProofCheck(
        name="engine8_step_812_files",
        passed=ok,
        detail="8.12 stories Signal modules present" if ok else "stories Signal modules missing",
    )


def _check_step_812_policy() -> ProofCheck:
    policy = (REPO_ROOT / "backend/core/signal_status_policy.py").read_text(encoding="utf-8")
    router = (REPO_ROOT / "backend/routers/statuses.py").read_text(encoding="utf-8")
    ok = "signal_status_v1" in policy and "validate_status_payload" in router
    return ProofCheck(
        name="engine8_step_812_policy",
        passed=ok,
        detail="8.12 signal_status_v1 backend policy + router wired" if ok else "status policy missing",
    )


def _check_step_812() -> ProofCheck:
    from core.signal_policy import ENGINE8_STEPS

    ok = any(s[0] == "8.12" and s[2] for s in ENGINE8_STEPS)
    return ProofCheck(
        name="engine8_step_812",
        passed=ok,
        detail="8.12 Stories Signal encryption complete" if ok else "8.12 not marked done",
    )


def run_signal_proof_step_812() -> SignalProofReport:
    checks = run_signal_proof_step_811().checks + [
        _check_step_812_files(),
        _check_step_812_policy(),
        _check_step_812(),
    ]
    return SignalProofReport(checks=checks)


def _check_q55_pqxdh_policy() -> ProofCheck:
    from core.pqxdh_policy import kyber_required_in_bundle, pqxdh_hybrid_enabled
    from core.signal_policy import ENGINE8_DEFERRED, ENGINE8_V1_SCOPE, LIBSIGNAL_PINNED_VERSION

    policy = (REPO_ROOT / "backend/core/pqxdh_policy.py").read_text(encoding="utf-8")
    ok = (
        pqxdh_hybrid_enabled()
        and kyber_required_in_bundle()
        and "post_quantum_pqxdh" in ENGINE8_V1_SCOPE
        and "post_quantum_pqxdh" not in ENGINE8_DEFERRED
        and "Kyber" in policy
        and LIBSIGNAL_PINNED_VERSION >= "0.96.4"
    )
    return ProofCheck(
        name="q55_pqxdh_policy",
        passed=ok,
        detail=f"Q.55 PQXDH hybrid active at libsignal {LIBSIGNAL_PINNED_VERSION}" if ok else "PQXDH policy incomplete",
    )


def _check_q55_kyber_in_bundle() -> ProofCheck:
    prekeys = (REPO_ROOT / "backend/core/prekey_bundle.py").read_text(encoding="utf-8")
    plugin = (REPO_ROOT / "frontend/android/app/src/main/java/chat/ssc/secure/plugins/SscLibsignalPlugin.java").read_text(
        encoding="utf-8"
    )
    bridge = (REPO_ROOT / "frontend/desktop/electron/libsignal/bridge.mjs").read_text(encoding="utf-8")
    ok = (
        "validate_kyber_public" in prekeys
        and "KyberPreKeyRecord" in plugin
        and "KEMPublicKey" in bridge
        and "kyber_prekey_public" in bridge
    )
    return ProofCheck(
        name="q55_kyber_bundle",
        passed=ok,
        detail="Q.55 Kyber prekeys required in bundle + session establishment" if ok else "Kyber bundle wiring incomplete",
    )


def _check_q55_libsignal_bump() -> ProofCheck:
    from core.signal_policy import LIBSIGNAL_PINNED_VERSION

    gradle = (REPO_ROOT / "frontend/android/app/build.gradle").read_text(encoding="utf-8")
    constants = (REPO_ROOT / "frontend/src/lib/signal/constants.js").read_text(encoding="utf-8")
    desktop_pkg = (REPO_ROOT / "frontend/desktop/package.json").read_text(encoding="utf-8")
    pinned = f"libsignal-android:{LIBSIGNAL_PINNED_VERSION}"
    ok = (
        pinned in gradle
        and LIBSIGNAL_PINNED_VERSION in constants
        and f'"@signalapp/libsignal-client": "{LIBSIGNAL_PINNED_VERSION}"' in desktop_pkg
    )
    return ProofCheck(
        name="q55_libsignal_bump",
        passed=ok,
        detail=f"Q.55 libsignal pinned to {LIBSIGNAL_PINNED_VERSION}" if ok else "libsignal version pins out of sync",
    )


def _check_q55_client_policy() -> ProofCheck:
    client = (REPO_ROOT / "frontend/src/lib/signal/pqxdhPolicy.js").read_text(encoding="utf-8")
    prekeys = (REPO_ROOT / "frontend/src/lib/signal/prekeys.js").read_text(encoding="utf-8")
    badge = (REPO_ROOT / "frontend/src/components/EncryptionModeBadge.jsx").read_text(encoding="utf-8")
    ok = (
        "PQXDH_HYBRID_ENABLED" in client
        and "bundleHasKyberPrekeys" in prekeys
        and "signalUsesPqxdh" in badge
    )
    return ProofCheck(
        name="q55_client_policy",
        passed=ok,
        detail="Q.55 client PQXDH policy + upload guard + UI labels" if ok else "client PQXDH policy incomplete",
    )


def run_signal_proof_step_855() -> SignalProofReport:
    checks = run_signal_proof_step_812().checks + [
        _check_q55_pqxdh_policy(),
        _check_q55_kyber_in_bundle(),
        _check_q55_libsignal_bump(),
        _check_q55_client_policy(),
    ]
    return SignalProofReport(checks=checks)


def run_signal_proof() -> SignalProofReport:
    """Full Engine 8 sign-off proof (through 8.12 + Q.55 PQXDH)."""
    return run_signal_proof_step_855()