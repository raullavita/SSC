"""WebAuthn / passkey policy — Q.40 optional passwordless login."""
from __future__ import annotations

import os
from typing import List, Optional
from urllib.parse import urlparse

PASSKEY_MAX_PER_USER = 10
CHALLENGE_TTL_SEC = 300


def _env() -> str:
    return os.environ.get("ENV", "development").lower()


def passkeys_enabled() -> bool:
    return bool(webauthn_rp_id())


def webauthn_rp_id() -> str:
    raw = (os.environ.get("WEBAUTHN_RP_ID") or "").strip()
    if raw:
        return raw
    if _env() in ("development", "test"):
        return "localhost"
    return ""


def webauthn_rp_name() -> str:
    return (os.environ.get("WEBAUTHN_RP_NAME") or "SSC").strip() or "SSC"


def webauthn_allowed_origins() -> List[str]:
    raw = (os.environ.get("WEBAUTHN_ORIGINS") or "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    if _env() in ("development", "test"):
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://localhost",
            "capacitor://localhost",
        ]
    base = (os.environ.get("PUBLIC_APP_URL") or "").strip().rstrip("/")
    if base:
        return [base]
    return []


def normalize_request_origin(origin: Optional[str]) -> Optional[str]:
    if not origin:
        return None
    return origin.strip().rstrip("/")


def is_allowed_origin(origin: Optional[str]) -> bool:
    normalized = normalize_request_origin(origin)
    if not normalized:
        return False
    allowed = {normalize_request_origin(o) for o in webauthn_allowed_origins()}
    return normalized in allowed


def user_id_to_bytes(user_id: str) -> bytes:
    encoded = user_id.encode("utf-8")
    if not encoded or len(encoded) > 64:
        raise ValueError("Invalid user id for WebAuthn")
    return encoded


def origin_from_url(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def auth_public_passkey_config() -> dict:
    return {
        "passkeys_enabled": passkeys_enabled(),
        "rp_id": webauthn_rp_id() if passkeys_enabled() else "",
    }