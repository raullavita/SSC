"""Q.63 — iOS App Store listing policy (TASK K)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

from core.agpl_policy import PLAY_STORE_SOURCE_SNIPPET, SOURCE_REPO_URL

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_STORE_DIR = REPO_ROOT / "app-store"
LISTING_COPY_PATH = APP_STORE_DIR / "LISTING_COPY.md"
PRIVACY_NUTRITION_PATH = APP_STORE_DIR / "PRIVACY_NUTRITION.json"
GRAPHICS_CHECKLIST_PATH = APP_STORE_DIR / "GRAPHICS_CHECKLIST.md"

IOS_BUNDLE_ID = "chat.ssc.secure"
APPLE_DEVELOPER_FEE_USD_YEAR = 99
APP_STORE_LISTING_ENV = "SSC_IOS_APP_STORE_URL"
TESTFLIGHT_URL_ENV = "SSC_IOS_TESTFLIGHT_URL"

APP_STORE_REQUIREMENTS: Tuple[str, ...] = (
    "apple_developer_program",
    "macos_xcode_build",
    "app_store_connect_listing",
    "app_privacy_nutrition_labels",
    "store_screenshots",
    "agpl_source_offer_in_listing",
    "testflight_before_production",
    "usage_description_strings_in_info_plist",
)

LISTING_DEFAULTS: Dict[str, str] = {
    "app_name": "SSC — Super Secure Chat",
    "subtitle": "Encrypted ephemeral chat",
    "promotional_text": "Private chat with Signal-grade encryption. Messages disappear by default.",
    "description": (
        "SSC (Super Secure Chat) is a privacy-first messaging app for encrypted conversations "
        "that disappear by default.\n\n"
        "• End-to-end encryption (libsignal / PQXDH roadmap on iOS)\n"
        "• Ephemeral by default — 24h retention\n"
        "• Voice and video calls\n"
        "• App lock, 2FA, panic wipe\n"
        "• Installed app only — no browser chat\n\n"
        f"{PLAY_STORE_SOURCE_SNIPPET}\n\n"
        "Website: https://www.supersecurechat.com\n"
        "Privacy: https://www.supersecurechat.com/privacy"
    ),
    "category_primary": "Social Networking",
    "category_secondary": "Utilities",
    "contact_email": "contact@supersecurechat.com",
    "website": "https://www.supersecurechat.com",
    "privacy_policy_url": "https://www.supersecurechat.com/privacy",
    "support_url": "https://www.supersecurechat.com/status",
}


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def load_privacy_nutrition() -> Dict[str, Any]:
    if not PRIVACY_NUTRITION_PATH.is_file():
        return {}
    try:
        return json.loads(PRIVACY_NUTRITION_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def app_store_listing_files() -> List[str]:
    paths = [
        LISTING_COPY_PATH,
        PRIVACY_NUTRITION_PATH,
        GRAPHICS_CHECKLIST_PATH,
        REPO_ROOT / "scripts" / "APP_STORE_SETUP.txt",
        REPO_ROOT / "SSC-BUILD-IOS.sh",
    ]
    return [str(p.relative_to(REPO_ROOT)).replace("\\", "/") for p in paths if p.is_file()]


def app_store_public_config() -> Dict[str, Any]:
    store_url = _env(APP_STORE_LISTING_ENV)
    testflight = _env(TESTFLIGHT_URL_ENV)
    return {
        "bundle_id": IOS_BUNDLE_ID,
        "listing_live": bool(store_url),
        "store_url": store_url or None,
        "testflight_url": testflight or None,
        "developer_fee_usd_per_year": APPLE_DEVELOPER_FEE_USD_YEAR,
        "build_requires_macos": True,
        "requirements": list(APP_STORE_REQUIREMENTS),
        "listing_defaults": dict(LISTING_DEFAULTS),
        "source_repo_url": SOURCE_REPO_URL,
        "agpl_snippet": PLAY_STORE_SOURCE_SNIPPET,
        "founder_setup": "scripts/APP_STORE_SETUP.txt",
        "listing_files": app_store_listing_files(),
        "privacy_nutrition": load_privacy_nutrition(),
        "ios_charter": "memory/IOS_CAPACITOR_CHARTER.md",
    }