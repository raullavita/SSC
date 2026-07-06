"""Step 18 — release v0.3.0 policy tests."""

from __future__ import annotations

from pathlib import Path

from core.release_policy import (
    ANDROID_ARTIFACT,
    ANDROID_CLIENT_HEADER,
    ELECTRON_ARTIFACT,
    ELECTRON_CLIENT_HEADER,
    GITHUB_RELEASE_DOWNLOAD_BASE,
    RELEASE_BUILD,
    RELEASE_LABEL,
    RELEASE_TAG,
    RELEASE_VERSION,
    step18_release_ready,
)

REPO = Path(__file__).resolve().parents[2]


def test_release_constants():
    assert RELEASE_VERSION == "0.3.1"
    assert RELEASE_BUILD == "9"
    assert RELEASE_TAG == "v0.3.1"
    assert RELEASE_LABEL == "v0.3.1 (build 9)"
    assert ELECTRON_ARTIFACT == "SSC-Setup-0.3.1.exe"
    assert ANDROID_ARTIFACT == "SSC-0.3.1.apk"
    assert ELECTRON_CLIENT_HEADER == "electron/0.3.1/9"
    assert ANDROID_CLIENT_HEADER == "android/0.3.1/9"
    assert GITHUB_RELEASE_DOWNLOAD_BASE.endswith("/releases/download/v0.3.1")
    assert step18_release_ready()


def test_changelog_has_v030():
    text = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## [{RELEASE_VERSION}]" in text
    assert "Encrypted backup" in text or "backup" in text.lower()


def test_release_checklist_exists():
    path = REPO / "memory" / "RELEASE_v0.3.0_CHECKLIST.md"
    assert path.is_file()
    assert "0.3" in path.read_text(encoding="utf-8")


def test_version_alignment():
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    api_client = (
        REPO / "android" / "app" / "src" / "main" / "java" / "com" / "supersecurechat" / "app" / "ApiClient.kt"
    ).read_text(encoding="utf-8")
    health = (REPO / "backend" / "routers" / "health.py").read_text(encoding="utf-8")
    assert f'versionName = "{RELEASE_VERSION}"' in gradle
    assert ANDROID_CLIENT_HEADER in api_client
    assert "RELEASE_VERSION" in health