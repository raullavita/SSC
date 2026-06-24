"""Unified identity policy tests."""
from pathlib import Path

from core.unified_identity_policy import (
    BROWSER_REGISTRATION_ALLOWED,
    IDENTITY_PRIMARY_SIGNAL,
    UNIFIED_IDENTITY_STEPS,
    is_unified_signal_user,
    unified_identity_complete,
)

REPO = Path(__file__).resolve().parents[2]


def test_unified_identity_steps_complete():
    assert unified_identity_complete() is True


def test_browser_registration_disallowed():
    assert BROWSER_REGISTRATION_ALLOWED is False


def test_is_unified_signal_user():
    assert is_unified_signal_user({"identity_primary": IDENTITY_PRIMARY_SIGNAL}) is True
    assert is_unified_signal_user({"signal_prekeys_ready": True}) is True
    assert is_unified_signal_user({"public_key": "rsa-only"}) is False


def test_charter_exists():
    text = (REPO / "memory" / "UNIFIED_IDENTITY_CHARTER.md").read_text(encoding="utf-8")
    assert "identity_primary" in text
    assert "signal_v1" in text


def test_keys_router_sets_identity_primary():
    text = (REPO / "backend" / "routers" / "keys.py").read_text(encoding="utf-8")
    assert "identity_primary" in text


def test_installed_client_gate_in_app():
    text = (REPO / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    assert "InstalledClientGate" in text


def test_register_bootstraps_signal_identity_on_installed():
    text = (REPO / "frontend" / "src" / "pages" / "Register.jsx").read_text(encoding="utf-8")
    assert "bootstrapSignalIdentity" in text


def test_landing_browser_download_mode():
    text = (REPO / "frontend" / "src" / "pages" / "Landing.jsx").read_text(encoding="utf-8")
    assert "isInstalledClient" in text
    assert "landingDownload" in text or "landingGetWindows" in text