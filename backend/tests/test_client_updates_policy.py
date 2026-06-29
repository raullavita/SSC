import asyncio

from core.client_updates_policy import (
    DEFAULT_ANDROID_APK_URL,
    DEFAULT_DESKTOP_FEED_URL,
    DEFAULT_LATEST_VERSION,
    client_updates_public_config,
)
from routers.config_route import public_config


def test_client_updates_defaults():
    cfg = client_updates_public_config()
    assert cfg["latest_version"] == DEFAULT_LATEST_VERSION
    assert cfg["desktop"]["feed_url"] == DEFAULT_DESKTOP_FEED_URL
    assert cfg["desktop"]["auto_update"] is True
    assert cfg["android"]["apk_url"] == DEFAULT_ANDROID_APK_URL
    assert cfg["android"]["in_app_check"] is True
    assert cfg["android"]["app_distribution_url"] is None
    assert cfg["android"]["play_store_url"] is None
    assert cfg["android"]["prefer_play_store"] is False
    assert cfg["ios"]["app_store_url"] is None
    assert cfg["ios"]["testflight_url"] is None


def test_public_config_includes_client_updates():
    data = asyncio.run(public_config())
    assert "client_updates" in data
    assert data["client_updates"]["latest_version"] == DEFAULT_LATEST_VERSION