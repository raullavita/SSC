"""Step 18 — release version policy tests (native Android 0.4.x)."""

from __future__ import annotations

from pathlib import Path

from core.release_policy import (
    ANDROID_ARTIFACT,
    ANDROID_CLIENT_HEADER,
    GITHUB_RELEASE_DOWNLOAD_BASE,
    RELEASE_BUILD,
    RELEASE_LABEL,
    RELEASE_TAG,
    RELEASE_VERSION,
    step18_release_ready,
)

REPO = Path(__file__).resolve().parents[2]


def test_release_constants():
    assert RELEASE_VERSION == "0.4.0"
    assert RELEASE_BUILD == "15"
    assert RELEASE_TAG == "v0.4.0"
    assert RELEASE_LABEL == "v0.4.0 (build 15)"
    assert ANDROID_ARTIFACT == "SSC-0.4.0.apk"
    assert ANDROID_CLIENT_HEADER == "android/0.4.0/15"
    assert GITHUB_RELEASE_DOWNLOAD_BASE.endswith("/releases/download/v0.4.0")
    assert step18_release_ready()


def test_changelog_has_release():
    text = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## [{RELEASE_VERSION}]" in text
    assert "native" in text.lower() or "Compose" in text


def test_release_checklist_exists():
    # Historical 0.3 checklist may remain; 0.4 uses native charter.
    path_v3 = REPO / "memory" / "RELEASE_v0.3.0_CHECKLIST.md"
    path_native = REPO / "memory" / "NATIVE_CLIENT_CHARTER.md"
    assert path_v3.is_file() or path_native.is_file()
    assert path_native.is_file()


def test_version_alignment():
    gradle = (REPO / "android" / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    health = (REPO / "backend" / "routers" / "health.py").read_text(encoding="utf-8")
    assert f'versionName = "{RELEASE_VERSION}"' in gradle
    assert f'versionCode = {RELEASE_BUILD}' in gradle or "versionCode = 15" in gradle
    assert ANDROID_CLIENT_HEADER in gradle
    assert "RELEASE_VERSION" in health
    assert "compose = true" in gradle
