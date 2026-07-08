"""Step 17 — Android WebView shell (shared React UI with Electron)."""

from __future__ import annotations

from pathlib import Path

from core.android_shell_policy import (
    ANDROID_APP_LINK_HOST,
    ANDROID_DEEP_LINK_HOSTS,
    ANDROID_DEEP_LINK_SCHEME,
    NATIVE_SHELL_FEATURES,
    build_android_web_path,
    step17_android_shell_ready,
)

REPO = Path(__file__).resolve().parents[2]
ANDROID_ROOT = REPO / "android" / "app" / "src" / "main" / "java" / "com" / "supersecurechat" / "app"


def test_android_shell_constants():
    assert ANDROID_DEEP_LINK_SCHEME == "ssc"
    assert "link-device" in ANDROID_DEEP_LINK_HOSTS
    assert "add" in ANDROID_DEEP_LINK_HOSTS
    assert "auth" in ANDROID_DEEP_LINK_HOSTS
    assert ANDROID_APP_LINK_HOST == "www.supersecurechat.com"
    assert "deep_links" in NATIVE_SHELL_FEATURES


def test_build_android_web_path():
    assert build_android_web_path("link-device", query="?token=abc") == "/link-device?token=abc"
    assert build_android_web_path("add", path="alice") == "/add/alice"
    assert build_android_web_path("auth", query="?oauth_code=abc") == "/auth?oauth_code=abc"
    assert build_android_web_path("unknown") == "/"


def test_step17_android_shell_ready():
    assert step17_android_shell_ready()


def test_manifest_deep_links_and_theme():
    manifest = (REPO / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(
        encoding="utf-8"
    )
    assert 'android:scheme="ssc"' in manifest
    assert "link-device" in manifest
    assert 'android:host="auth"' in manifest
    assert "Theme.SSC" in manifest


def test_main_activity_webview_shell_features():
    main = (ANDROID_ROOT / "MainActivity.kt").read_text(encoding="utf-8")
    assert "WebView" in main
    assert "installSplashScreen" in main
    assert "SscNativeBridge" in main
    assert "SwipeRefreshLayout" in main
    assert "SscDeepLink" in main
    assert "__sscBridge" in main
    assert "SscPushBridge" in main
    assert "SscFirebasePush" in main


def test_android_fcm_push_wiring():
    manifest = (REPO / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(
        encoding="utf-8"
    )
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    assert "SscFirebaseMessagingService" in manifest
    assert "POST_NOTIFICATIONS" in manifest
    assert "firebase-messaging" in gradle
    assert (ANDROID_ROOT / "SscPushBridge.kt").is_file()


def test_android_oauth_custom_tabs():
    launcher = (ANDROID_ROOT / "SscOAuthLauncher.kt").read_text(encoding="utf-8")
    api = (ANDROID_ROOT / "ApiClient.kt").read_text(encoding="utf-8")
    assert "CustomTabsIntent" in launcher
    assert "isOAuthStart" in launcher
    assert "android/0.3.1/10" in api
    assert "X-SSC-Client" in api


def test_android_native_bridge_and_assets():
    bridge = (ANDROID_ROOT / "SscNativeBridge.kt").read_text(encoding="utf-8")
    crypto_js = REPO / "android" / "app" / "src" / "main" / "assets" / "ssc_crypto_bridge.js"
    layout = REPO / "android" / "app" / "src" / "main" / "res" / "layout" / "activity_main.xml"
    assert "fetchApi" in bridge
    assert "SscCryptoService" in bridge
    assert crypto_js.is_file()
    assert layout.is_file()
    assert "WebView" in layout.read_text(encoding="utf-8")


def test_android_webview_shell_build():
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    script = (REPO / "scripts" / "build_android.ps1").read_text(encoding="utf-8")
    assert "SSC_WEB_URL" in gradle
    assert "android_asset/www/index.html" in gradle
    assert "versionCode = 10" in gradle
    assert "assets/www" in script
    assert '$Build = "10"' in script