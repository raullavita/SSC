"""Android client shell — native Jetpack Compose (no WebView messenger UI)."""

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
UI_ROOT = ANDROID_ROOT / "ui"


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


def test_main_activity_is_native_compose():
    main = (ANDROID_ROOT / "MainActivity.kt").read_text(encoding="utf-8")
    assert "setContent" in main
    assert "SscApp" in main
    assert "installSplashScreen" in main
    assert "import android.webkit.WebView" not in main
    assert "findViewById" not in main


def test_compose_ui_surface_exists():
    assert (UI_ROOT / "SscApp.kt").is_file()
    assert (UI_ROOT / "auth" / "LoginScreen.kt").is_file()
    assert (UI_ROOT / "chat" / "ConversationListScreen.kt").is_file()
    assert (UI_ROOT / "chat" / "ChatThreadScreen.kt").is_file()
    ssc_app = (UI_ROOT / "SscApp.kt").read_text(encoding="utf-8")
    assert "SscRealtime" in ssc_app
    assert "PushRegistrar" in ssc_app


def test_android_fcm_push_wiring():
    manifest = (REPO / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(
        encoding="utf-8"
    )
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    assert "SscFirebaseMessagingService" in manifest
    assert "POST_NOTIFICATIONS" in manifest
    assert "firebase-messaging" in gradle
    assert (ANDROID_ROOT / "SscPushBridge.kt").is_file()
    push = (ANDROID_ROOT / "SscPushBridge.kt").read_text(encoding="utf-8")
    assert "import android.webkit.WebView" not in push
    assert "injectIntoWebView" not in push


def test_android_native_http_and_client_header():
    http = (ANDROID_ROOT / "data" / "SscHttpClient.kt").read_text(encoding="utf-8")
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    assert "X-SSC-Client" in http
    assert "X-SSC-Native-Bridge" in http
    assert "Authorization" in http
    assert "SSC_CLIENT_IDENTITY" in gradle
    assert "android/0.4.0/15" in gradle
    assert "compose = true" in gradle


def test_android_libsignal_and_session():
    assert (ANDROID_ROOT / "LibsignalSession.kt").is_file()
    assert (ANDROID_ROOT / "data" / "SignalMessaging.kt").is_file()
    assert (ANDROID_ROOT / "data" / "SessionStore.kt").is_file()
    signal = (ANDROID_ROOT / "data" / "SignalMessaging.kt").read_text(encoding="utf-8")
    assert "toServerPrekeyPayload" in signal or "prekeys/bundle" in signal


def test_android_native_build_script():
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    script = (REPO / "scripts" / "build_android.ps1").read_text(encoding="utf-8")
    assert "SSC_WEB_URL" not in gradle
    assert "android_asset/www" not in gradle
    assert "versionCode = 15" in gradle
    assert "assets/www" not in script
    assert "assembleRelease" in script or "bundleRelease" in script
    assert "Compose" in script or "native" in script.lower()
