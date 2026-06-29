"""Q.62 — Google Play public listing policy (TASK N.8 / P.9)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

from core.agpl_policy import PLAY_STORE_SOURCE_SNIPPET, SOURCE_REPO_URL

REPO_ROOT = Path(__file__).resolve().parents[2]
PLAY_STORE_DIR = REPO_ROOT / "play-store"
LISTING_COPY_PATH = PLAY_STORE_DIR / "LISTING_COPY.md"
DATA_SAFETY_PATH = PLAY_STORE_DIR / "DATA_SAFETY.json"
GRAPHICS_CHECKLIST_PATH = PLAY_STORE_DIR / "GRAPHICS_CHECKLIST.md"

ANDROID_PACKAGE_ID = "chat.ssc.secure"
PLAY_CONSOLE_FEE_USD = 25
PLAY_STORE_LISTING_ENV = "SSC_GOOGLE_PLAY_STORE_URL"
PLAY_STORE_PREFER_ENV = "SSC_ANDROID_PREFER_PLAY_STORE"

PLAY_STORE_REQUIREMENTS: Tuple[str, ...] = (
    "play_console_developer_account",
    "release_aab_signed",
    "store_listing_copy",
    "data_safety_form",
    "store_graphics",
    "agpl_source_offer_in_listing",
    "content_rating_questionnaire",
)

LISTING_DEFAULTS: Dict[str, str] = {
    "app_name": "SSC — Super Secure Chat",
    "short_description": (
        "Private ephemeral chat with Signal-grade encryption on your device. "
        "Messages auto-delete. Installed app only."
    ),
    "full_description": (
        "SSC (Super Secure Chat) is a privacy-first messaging app for people who want "
        "encrypted conversations that disappear by default.\n\n"
        "• End-to-end encryption with libsignal (PQXDH) on Android\n"
        "• Ephemeral by default — chats and files auto-delete (24h)\n"
        "• Voice and video calls with WebRTC\n"
        "• Panic wipe, app lock, 2FA, and sealed sender options\n"
        "• No browser-tab chat — install the app to sign in\n\n"
        f"{PLAY_STORE_SOURCE_SNIPPET}\n"
        "This app includes libsignal (Signal Foundation, AGPL-3.0). "
        "See in-app Settings → Open source for license details.\n\n"
        "Website: https://www.supersecurechat.com\n"
        "Privacy: https://www.supersecurechat.com/privacy\n"
        "Security: https://www.supersecurechat.com/security"
    ),
    "category": "Communication",
    "contact_email": "contact@supersecurechat.com",
    "website": "https://www.supersecurechat.com",
    "privacy_policy_url": "https://www.supersecurechat.com/privacy",
}


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def _env_flag(name: str) -> bool:
    return _env(name).lower() in ("1", "true", "yes", "on")


def load_data_safety_answers() -> Dict[str, Any]:
    if not DATA_SAFETY_PATH.is_file():
        return {}
    try:
        return json.loads(DATA_SAFETY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def play_store_listing_files() -> List[str]:
    paths = [
        LISTING_COPY_PATH,
        DATA_SAFETY_PATH,
        GRAPHICS_CHECKLIST_PATH,
        REPO_ROOT / "scripts" / "GOOGLE_PLAY_SETUP.txt",
    ]
    return [str(p.relative_to(REPO_ROOT)).replace("\\", "/") for p in paths if p.is_file()]


def play_store_public_config() -> Dict[str, Any]:
    store_url = _env(PLAY_STORE_LISTING_ENV)
    prefer = _env_flag(PLAY_STORE_PREFER_ENV)
    return {
        "package_id": ANDROID_PACKAGE_ID,
        "listing_live": bool(store_url),
        "store_url": store_url or None,
        "prefer_play_store": prefer,
        "developer_account_fee_usd": PLAY_CONSOLE_FEE_USD,
        "requirements": list(PLAY_STORE_REQUIREMENTS),
        "listing_defaults": dict(LISTING_DEFAULTS),
        "source_repo_url": SOURCE_REPO_URL,
        "agpl_snippet": PLAY_STORE_SOURCE_SNIPPET,
        "founder_setup": "scripts/GOOGLE_PLAY_SETUP.txt",
        "listing_files": play_store_listing_files(),
        "data_safety": load_data_safety_answers(),
    }