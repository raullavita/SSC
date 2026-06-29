"""Q.62 — Google Play listing policy tests."""
from pathlib import Path

from core.play_store_policy import (
    ANDROID_PACKAGE_ID,
    LISTING_DEFAULTS,
    PLAY_STORE_REQUIREMENTS,
    play_store_listing_files,
    play_store_public_config,
)

REPO = Path(__file__).resolve().parents[2]


def test_play_store_package_id_matches_gradle():
    gradle = (REPO / "frontend/android/app/build.gradle").read_text(encoding="utf-8")
    assert f'applicationId "{ANDROID_PACKAGE_ID}"' in gradle


def test_listing_files_exist():
    files = play_store_listing_files()
    assert "play-store/LISTING_COPY.md" in files
    assert "play-store/DATA_SAFETY.json" in files
    assert (REPO / "scripts" / "GOOGLE_PLAY_SETUP.txt").is_file()


def test_play_store_public_config_shape():
    cfg = play_store_public_config()
    assert cfg["package_id"] == ANDROID_PACKAGE_ID
    assert cfg["listing_live"] is False
    assert cfg["store_url"] is None
    assert len(cfg["requirements"]) == len(PLAY_STORE_REQUIREMENTS)
    assert "agpl_snippet" in cfg
    assert cfg["listing_defaults"]["privacy_policy_url"].startswith("https://")


def test_config_route_exposes_play_store():
    from routers.config_route import public_config
    import asyncio

    data = asyncio.run(public_config())
    assert "play_store" in data
    assert data["play_store"]["package_id"] == ANDROID_PACKAGE_ID


def test_landing_play_store_wiring():
    landing = (REPO / "frontend/src/pages/Landing.jsx").read_text(encoding="utf-8")
    assert "REACT_APP_GOOGLE_PLAY_STORE_URL" in landing
    assert "landing-download-play" in landing


def test_client_updates_prefers_play_store_field():
    text = (REPO / "backend/core/client_updates_policy.py").read_text(encoding="utf-8")
    assert "play_store_url" in text


def test_aab_build_documented():
    bat = (REPO / "SSC-BUILD-APK.bat").read_text(encoding="utf-8")
    assert "bundleRelease" in bat
    assert ".aab" in bat


def test_agpl_listing_snippet_in_copy():
    md = (REPO / "play-store/LISTING_COPY.md").read_text(encoding="utf-8")
    assert "github.com/raullavita/SSC" in md
    assert LISTING_DEFAULTS["privacy_policy_url"] in md