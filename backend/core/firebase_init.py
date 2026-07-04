"""Firebase Admin (FCM) — OSS google/firebase-admin for generic push."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("ssc")

_initialized = False


def firebase_ready() -> bool:
    return _initialized


def ensure_firebase() -> bool:
    """Initialize Firebase Admin once. Returns True if FCM can send."""
    global _initialized
    if _initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.debug("firebase-admin not installed")
        return False

    if firebase_admin._apps:  # noqa: SLF001
        _initialized = True
        return True

    cred = _load_credentials(credentials)
    if cred is None:
        return False

    try:
        firebase_admin.initialize_app(cred)
        _initialized = True
        logger.info("Firebase Admin initialized for FCM push")
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Firebase Admin init failed")
        return False


def _load_credentials(credentials_module: Any) -> Any | None:
    raw_json = os.getenv("FIREBASE_CREDENTIALS_JSON", "").strip()
    if raw_json:
        try:
            return credentials_module.Certificate(json.loads(raw_json))
        except json.JSONDecodeError:
            logger.error("FIREBASE_CREDENTIALS_JSON is invalid JSON")
            return None

    path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if path and os.path.isfile(path):
        return credentials_module.Certificate(path)

    try:
        return credentials_module.ApplicationDefault()
    except Exception:  # noqa: BLE001
        logger.debug("No Firebase credentials configured")
        return None