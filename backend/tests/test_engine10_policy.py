"""Engine 10 — desktop client policy tests."""
from pathlib import Path

from core.engine10_policy import (
    DESKTOP_CHARTER,
    DESKTOP_ELECTRON_DIR,
    DESKTOP_LIB_PACKAGE,
    ENGINE10_STEPS,
    GROUP_VIDEO_MAX_PARTICIPANTS,
    PRODUCT_SURFACES,
    browser_pwa_is_product,
    engine10_complete,
)
from core.signal_policy import LIBSIGNAL_PINNED_VERSION

REPO = Path(__file__).resolve().parents[2]


def test_engine10_steps_complete():
    assert engine10_complete() is True
    assert all(done for _, _, done in ENGINE10_STEPS)


def test_product_surfaces_installed_only():
    assert "android_apk" in PRODUCT_SURFACES
    assert "windows_desktop" in PRODUCT_SURFACES
    assert "mac_desktop" in PRODUCT_SURFACES
    assert browser_pwa_is_product() is False


def test_desktop_charter_and_electron_dir():
    assert (REPO / DESKTOP_CHARTER).is_file()
    assert (REPO / DESKTOP_ELECTRON_DIR / "package.json").is_file()
    assert (REPO / DESKTOP_ELECTRON_DIR / "electron" / "main.mjs").is_file()
    assert (REPO / DESKTOP_ELECTRON_DIR / "electron" / "libsignal" / "bridge.mjs").is_file()


def test_desktop_package_pins_libsignal():
    pkg = (REPO / DESKTOP_ELECTRON_DIR / "package.json").read_text(encoding="utf-8")
    assert DESKTOP_LIB_PACKAGE in pkg
    assert LIBSIGNAL_PINNED_VERSION in pkg


def test_platform_detects_electron():
    js = (REPO / "frontend/src/lib/platform.js").read_text(encoding="utf-8")
    assert "isElectronApp" in js
    assert "isInstalledClient" in js


def test_native_libsignal_supports_desktop():
    js = (REPO / "frontend/src/lib/signal/nativeLibsignal.js").read_text(encoding="utf-8")
    assert "isElectronApp" in js or "sscDesktop" in js


def test_group_video_cap_eight():
    assert GROUP_VIDEO_MAX_PARTICIPANTS == 8
    sfu = (REPO / "backend/core/sfu_policy.py").read_text(encoding="utf-8")
    assert "MESH_MAX_PARTICIPANTS = 8" in sfu


def test_roadmap_retired_browser_wasm():
    roadmap = (REPO / "memory/SSC-ROADMAP.md").read_text(encoding="utf-8")
    assert "10 Desktop" in roadmap or "Engine 10" in roadmap
    assert "Web/PWA" in roadmap and "Retired" in roadmap