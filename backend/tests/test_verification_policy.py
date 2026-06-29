"""Engine 2.6 + Engine 8.2 — verification handshake policy."""
from pathlib import Path

from core.verification_policy import (
    CLIENT_VERIFICATION_CONTROLS,
    FINGERPRINT_ITERATIONS,
    LEGACY_VERIFICATION_PREFIX,
    REQUIRED_RECORD_FIELDS,
    SAFETY_NUMBER_LENGTH,
    VERIFICATION_RECORD_VERSION,
    VERIFICATION_STORAGE_V2_PREFIX,
)


def test_verification_record_version_and_fields():
    assert VERIFICATION_RECORD_VERSION == 3
    assert SAFETY_NUMBER_LENGTH == 60
    assert FINGERPRINT_ITERATIONS == 5200
    assert REQUIRED_RECORD_FIELDS == frozenset({
        "v", "key_type", "safety_number", "peer_identity", "my_identity", "verified_at",
    })


def test_storage_prefixes():
    assert VERIFICATION_STORAGE_V2_PREFIX == "ssc_verified_v2_"
    assert LEGACY_VERIFICATION_PREFIX == "ssc_verified_"


def test_verification_lib_exports_crypto_binding():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "verification.js").read_text(encoding="utf-8")
    assert "markPeerVerified" in text
    assert "isPeerVerified" in text
    assert "computeSafetyNumberForUsers" in text
    assert "peer_identity" in text
    assert "VERIFICATION_RECORD_VERSION = 3" in text
    assert "purgeLegacyVerificationFlags" in text
    assert "localStorage.setItem(`ssc_verified_${peer.user_id}`, '1')" not in text


def test_safety_number_module_signal_iterations():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "safetyNumber.js").read_text(encoding="utf-8")
    assert "FINGERPRINT_ITERATIONS = 5200" in text
    assert "buildVerifyQrPayload" in text
    assert "api.qrserver.com" not in text


def test_verify_modal_text_only_no_qr():
    root = Path(__file__).resolve().parents[2]
    modal = (root / "frontend" / "src" / "components" / "VerifyHandshakeModal.jsx").read_text(encoding="utf-8")
    assert "from 'qrcode'" not in modal
    assert "QRCode.toDataURL" not in modal
    assert "verify-paste-input" in modal
    assert "verify-safety-number" in modal
    assert "api.qrserver.com" not in modal
    assert "localStorage.setItem" not in modal


def test_key_change_warning_banner_wired():
    root = Path(__file__).resolve().parents[2]
    chat = (root / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    banner = (root / "frontend" / "src" / "components" / "KeyChangeWarningBanner.jsx").read_text(encoding="utf-8")
    assert "KeyChangeWarningBanner" in chat
    assert "key-change-warning-banner" in banner
    warnings = (root / "frontend" / "src" / "lib" / "keyChangeWarnings.js").read_text(encoding="utf-8")
    assert "isPeerIdentityChanged" in warnings
    assert "handlePeerIdentityRotation" in warnings


def test_chat_home_hides_default_verify_ui():
    """TASK A.7 / O.4 — no default VERIFY button; modal via profile sheet only."""
    root = Path(__file__).resolve().parents[2]
    chat = (root / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    assert "verify-identity-button" not in chat
    assert "profile-sheet-verify" in (root / "frontend" / "src" / "components" / "ProfileContactSheet.jsx").read_text(encoding="utf-8")
    modal = root / "frontend" / "src" / "components" / "VerifyHandshakeModal.jsx"
    assert modal.is_file()


def test_auth_context_purges_legacy_verification():
    root = Path(__file__).resolve().parents[2]
    auth = (root / "frontend" / "src" / "context" / "AuthContext.jsx").read_text(encoding="utf-8")
    assert "purgeLegacyVerificationFlags" in auth


def test_client_control_paths_exist():
    root = Path(__file__).resolve().parents[2]
    for rel in CLIENT_VERIFICATION_CONTROLS:
        assert (root / rel).is_file(), rel