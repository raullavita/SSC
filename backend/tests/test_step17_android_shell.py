"""Step 17 — Android shell UX polish."""

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


def test_android_shell_constants():
    assert ANDROID_DEEP_LINK_SCHEME == "ssc"
    assert "link-device" in ANDROID_DEEP_LINK_HOSTS
    assert "add" in ANDROID_DEEP_LINK_HOSTS
    assert ANDROID_APP_LINK_HOST == "www.supersecurechat.com"
    assert "deep_links" in NATIVE_SHELL_FEATURES


def test_build_android_web_path():
    assert build_android_web_path("link-device", query="?token=abc") == "/link-device?token=abc"
    assert build_android_web_path("add", path="alice") == "/add/alice"
    assert build_android_web_path("unknown") == "/"


def test_step17_android_shell_ready():
    assert step17_android_shell_ready()


def test_manifest_deep_links_and_theme():
    manifest = (REPO / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(
        encoding="utf-8"
    )
    assert 'android:scheme="ssc"' in manifest
    assert "link-device" in manifest
    assert "Theme.SSC" in manifest


def test_main_activity_shell_features():
    main = (REPO / "android" / "app" / "src" / "main" / "java" / "com" / "supersecurechat" / "app" / "MainActivity.kt").read_text(
        encoding="utf-8"
    )
    assert "SplashScreen" in main
    assert "SwipeRefreshLayout" in main
    assert "onShowFileChooser" in main
    assert "SscDeepLink" in main


def test_android_oauth_custom_tabs():
    launcher = (
        REPO
        / "android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "com"
        / "supersecurechat"
        / "app"
        / "SscOAuthLauncher.kt"
    ).read_text(encoding="utf-8")
    api_client = (REPO / "android" / "app" / "src" / "main" / "java" / "com" / "supersecurechat" / "app" / "ApiClient.kt").read_text(
        encoding="utf-8"
    )
    assert "CustomTabsIntent" in launcher
    assert "isOAuthStart" in launcher
    assert "shouldOverrideUrlLoading" in api_client
    assert "isForMainFrame" in api_client


def test_deep_link_resolver():
    resolver = (
        REPO
        / "android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "com"
        / "supersecurechat"
        / "app"
        / "SscDeepLink.kt"
    ).read_text(encoding="utf-8")
    assert "resolveToWebUrl" in resolver
    assert '"ssc"' in resolver
    assert "file://" in resolver


def test_android_bundled_entry_url():
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    assert "android_asset/www/index.html" in gradle