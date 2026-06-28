"""Client auto-update policy — desktop feed + Android APK / App Distribution URLs."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

DEFAULT_LATEST_VERSION = "1.0.12"
DEFAULT_DESKTOP_FEED_URL = "https://www.supersecurechat.com/downloads/desktop/"
DEFAULT_ANDROID_APK_URL = "https://www.supersecurechat.com/downloads/SSC-app-release.apk"


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def client_updates_public_config() -> Dict[str, Any]:
    latest = _env("SSC_CLIENT_LATEST_VERSION", DEFAULT_LATEST_VERSION)
    desktop_feed = _env("SSC_DESKTOP_UPDATE_FEED_URL", DEFAULT_DESKTOP_FEED_URL).rstrip("/") + "/"
    android_apk = _env("SSC_ANDROID_APK_URL", DEFAULT_ANDROID_APK_URL)
    android_dist = _env("SSC_ANDROID_APP_DISTRIBUTION_URL")
    return {
        "latest_version": latest,
        "desktop": {
            "feed_url": desktop_feed,
            "auto_update": True,
        },
        "android": {
            "apk_url": android_apk,
            "app_distribution_url": android_dist or None,
            "in_app_check": True,
        },
    }


def desktop_update_feed_url() -> str:
    return client_updates_public_config()["desktop"]["feed_url"]


def android_update_url() -> Optional[str]:
    cfg = client_updates_public_config()["android"]
    return cfg.get("app_distribution_url") or cfg.get("apk_url") or None