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
    assert "ssc-shell:fetch-api" in main


def test_electron_preload_injects_client_header():
    preload = (REPO / "electron" / "preload.js").read_text(encoding="utf-8")
    assert "__SSC_ELECTRON_CLIENT" in preload
    assert "CLIENT_VALUE" in preload
    assert "SSC_VERSION" in preload
    assert "fetchApi" in preload
    assert "ssc-shell:fetch-api" in preload


def test_build_electron_uses_numeric_build():
    """Legacy Electron script kept for emergency rebuilds; product Windows path is Qt."""
    script = (REPO / "scripts" / "build_electron.ps1").read_text(encoding="utf-8")
    # Aligned with release_policy 0.4.0 / build 15 (no longer hard-coded 14)
    assert '$Build = "15"' in script or 'REACT_APP_SSC_BUILD = "15"' in script
    assert "REACT_APP_SSC_BUILD" in script
    assert 'REACT_APP_SSC_LANDING_ONLY = "false"' in script
    assert 'PUBLIC_URL = "."' in script


def test_windows_qt_desktop_product_path():
    """Native Qt desktop is the Windows product client (not Electron UI)."""
    cmake = (REPO / "desktop" / "CMakeLists.txt").read_text(encoding="utf-8")
    build = (REPO / "scripts" / "build_desktop_windows.ps1").read_text(encoding="utf-8")
    api = (REPO / "desktop" / "src" / "SscApiClient.cpp").read_text(encoding="utf-8")
    assert "ssc_desktop" in cmake
    assert "Qt6" in cmake
    assert "build_desktop_windows" in build or "SSC-Desktop" in build
    assert "windows/0.4.0/15" in api
    assert (REPO / "desktop" / "crypto-worker" / "worker.js").is_file()


def test_frontend_installed_shell_hash_router():
    index = (REPO / "frontend" / "src" / "index.js").read_text(encoding="utf-8")
    assert "HashRouter" in index
    assert "'android'" in index
    assert "INSTALLED_SHELL_PLATFORMS" in index


def test_android_native_compose_build():
    """Product Android client is Jetpack Compose — no WebView/React assets bundle."""
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    script = (REPO / "scripts" / "build_android.ps1").read_text(encoding="utf-8")
    main = (
        REPO
        / "android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "com"
        / "supersecurechat"
        / "app"
        / "MainActivity.kt"
    ).read_text(encoding="utf-8")
    assert "com.supersecurechat.app" in gradle
    assert "compose = true" in gradle
    assert "SSC_WEB_URL" not in gradle
    assert "versionCode = 15" in gradle
    assert "assets/www" not in script
    assert "import android.webkit.WebView" not in main
    assert "SscApp" in main
    assert "setContent" in main
    assert "assembleRelease" in script or "bundleRelease" in script