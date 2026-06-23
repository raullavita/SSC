"""Engine 2 Step 2.6 — verification handshake hardening."""
from pathlib import Path

from core.verification_policy import (
    CLIENT_VERIFICATION_CONTROLS,
    LEGACY_VERIFICATION_PREFIX,
    REQUIRED_RECORD_FIELDS,
    SAFETY_NUMBER_LENGTH,
    VERIFICATION_RECORD_VERSION,
    VERIFICATION_STORAGE_V2_PREFIX,
)


def test_verification_record_version_and_fields():
    assert VERIFICATION_RECORD_VERSION == 1
    assert SAFETY_NUMBER_LENGTH == 60
    assert REQUIRED_RECORD_FIELDS == frozenset({
        "v", "safety_number", "peer_fingerprint", "my_fingerprint", "verified_at",
    })


def test_storage_prefixes():
    assert VERIFICATION_STORAGE_V2_PREFIX == "ssc_verified_v2_"
    assert LEGACY_VERIFICATION_PREFIX == "ssc_verified_"


def test_verification_lib_exports_crypto_binding():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "verification.js").read_text(encoding="utf-8")
    assert "markPeerVerified" in text
    assert "isPeerVerified" in text
    assert "safety_number" in text
    assert "peer_fingerprint" in text
    assert "purgeLegacyVerificationFlags" in text
    assert "localStorage.setItem(`ssc_verified_${peer.user_id}`, '1')" not in text


def test_verify_modal_uses_verification_lib():
    root = Path(__file__).resolve().parents[2]
    modal = (root / "frontend" / "src" / "components" / "VerifyHandshakeModal.jsx").read_text(encoding="utf-8")
    assert "from '../lib/verification'" in modal
    assert "markPeerVerified" in modal
    assert "isPeerVerified" in modal
    assert "localStorage.setItem" not in modal


def test_chat_home_wires_verify_flow():
    root = Path(__file__).resolve().parents[2]
    chat = (root / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    assert "VerifyHandshakeModal" in chat
    assert "isPeerVerified" in chat
    assert "verify-identity-button" in chat
    assert "peerVerified" in chat


def test_auth_context_purges_legacy_verification():
    root = Path(__file__).resolve().parents[2]
    auth = (root / "frontend" / "src" / "context" / "AuthContext.jsx").read_text(encoding="utf-8")
    assert "purgeLegacyVerificationFlags" in auth


def test_client_control_paths_exist():
    root = Path(__file__).resolve().parents[2]
    for rel in CLIENT_VERIFICATION_CONTROLS:
        assert (root / rel).is_file(), rel