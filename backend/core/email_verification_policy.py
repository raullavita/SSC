"""Email verification policy — Q.36 password register activation links."""
from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlencode

from core.config import ENV

EMAIL_VERIFY_TOKEN_TTL_HOURS = 24
RESEND_COOLDOWN_SECONDS = 120


def email_verification_required() -> bool:
    return os.environ.get("EMAIL_VERIFICATION_REQUIRED", "false").lower() in ("1", "true", "yes")


def public_app_base_url() -> str:
    raw = (os.environ.get("PUBLIC_APP_URL") or "").strip().rstrip("/")
    if raw:
        return raw
    if ENV == "production":
        return "https://supersecurechat.com"
    return "http://localhost:3000"


def email_from_address() -> Optional[str]:
    return (os.environ.get("EMAIL_FROM_ADDRESS") or "").strip() or None


def email_from_name() -> str:
    return (os.environ.get("EMAIL_FROM_NAME") or "SSC").strip() or "SSC"


def build_verification_url(token: str) -> str:
    base = public_app_base_url()
    query = urlencode({"token": token})
    if "#" in base:
        return f"{base.rstrip('/')}/verify-email?{query}"
    use_hash = os.environ.get("PUBLIC_APP_URL_HASH_ROUTER", "true").lower() in ("1", "true", "yes")
    if use_hash:
        return f"{base}/#/verify-email?{query}"
    return f"{base}/verify-email?{query}"


def is_email_verified(user: dict) -> bool:
    """Google accounts are always verified; legacy rows without the field stay verified."""
    if not user:
        return False
    if user.get("auth_provider") == "google":
        return True
    if "email_verified" not in user:
        return True
    return bool(user.get("email_verified"))


def auth_public_config() -> dict:
    return {
        "email_verification_required": email_verification_required(),
    }