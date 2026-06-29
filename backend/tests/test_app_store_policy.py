"""Q.63 — iOS App Store listing policy tests."""
from pathlib import Path

from core.app_store_policy import (
    APP_STORE_REQUIREMENTS,
    IOS_BUNDLE_ID,
    LISTING_DEFAULTS,
    app_store_listing_files,
    app_store_public_config,
)

REPO = Path(__file__).resolve().parents[2]


def test_bundle_id_matches_capacitor():
    cfg = (REPO / "frontend/capacitor.config.json").read_text(encoding="utf-8")
    assert f'"appId": "{IOS_BUNDLE_ID}"' in cfg


def test_listing_files_exist():
    files = app_store_listing_files()
    assert "app-store/LISTING_COPY.md" in files
    assert "app-store/PRIVACY_NUTRITION.json" in files
    assert (REPO / "scripts/APP_STORE_SETUP.txt").is_file()


def test_app_store_public_config_shape():
    cfg = app_store_public_config()
    assert cfg["bundle_id"] == IOS_BUNDLE_ID
    assert cfg["listing_live"] is False
    assert cfg["build_requires_macos"] is True
    assert len(cfg["requirements"]) == len(APP_STORE_REQUIREMENTS)
    assert cfg["developer_fee_usd_per_year"] == 99


def test_config_route_exposes_app_store():
    from routers.config_route import public_config
    import asyncio

    data = asyncio.run(public_config())
    assert "app_store" in data
    assert data["app_store"]["bundle_id"] == IOS_BUNDLE_ID


def test_info_plist_usage_descriptions():
    plist = (REPO / "frontend/ios/App/App/Info.plist").read_text(encoding="utf-8")
    assert "NSCameraUsageDescription" in plist
    assert "NSMicrophoneUsageDescription" in plist
    assert "NSPhotoLibraryUsageDescription" in plist
    assert "CFBundleURLTypes" in plist


def test_landing_ios_store_wiring():
    landing = (REPO / "frontend/src/pages/Landing.jsx").read_text(encoding="utf-8")
    assert "REACT_APP_IOS_APP_STORE_URL" in landing or "REACT_APP_IOS_TESTFLIGHT_URL" in landing


def test_ios_build_script_exists():
    assert (REPO / "SSC-BUILD-IOS.sh").is_file()


def test_listing_copy_has_agpl_and_privacy():
    md = (REPO / "app-store/LISTING_COPY.md").read_text(encoding="utf-8")
    assert "github.com/raullavita/SSC" in md
    assert LISTING_DEFAULTS["privacy_policy_url"] in md