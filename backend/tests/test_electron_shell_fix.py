"""Electron packaged shell fixes — post v0.3.0."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_electron_main_loads_packaged_app():
    main = (REPO / "electron" / "main.js").read_text(encoding="utf-8")
    assert "app.isPackaged" in main
    assert "process.resourcesPath" in main
    assert "resolvePackagedIndex" in main
    assert "attachOAuthNavigationHandlers" in main
    assert "isOAuthFinishUrl" in main
    assert "completeOAuthFinishNavigation" in main
    assert "withoutScheme" in main
    assert "host === 'auth'" in main


def test_electron_preload_injects_client_header():
    preload = (REPO / "electron" / "preload.js").read_text(encoding="utf-8")
    assert "__SSC_ELECTRON_CLIENT" in preload
    assert "CLIENT_VALUE" in preload
    assert "SSC_VERSION" in preload


def test_build_electron_uses_numeric_build():
    script = (REPO / "scripts" / "build_electron.ps1").read_text(encoding="utf-8")
    assert 'REACT_APP_SSC_BUILD = "10"' in script
    assert 'REACT_APP_SSC_LANDING_ONLY = "false"' in script
    assert 'PUBLIC_URL = "."' in script


def test_frontend_installed_shell_hash_router():
    index = (REPO / "frontend" / "src" / "index.js").read_text(encoding="utf-8")
    assert "HashRouter" in index
    assert "'android'" in index
    assert "INSTALLED_SHELL_PLATFORMS" in index


def test_android_native_shell_build():
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    script = (REPO / "scripts" / "build_android.ps1").read_text(encoding="utf-8")
    assert "com.supersecurechat.app" in gradle
    assert "versionCode = 10" in gradle
    assert "assembleRelease" in script or "bundleRelease" in script