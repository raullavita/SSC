"""CAPTCHA verification — Cloudflare Turnstile (Phase 3)."""

from __future__ import annotations

import os

import httpx

_TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def captcha_required() -> bool:
    raw = os.getenv("SSC_CAPTCHA_REQUIRED", "false").strip().lower()
    return raw in ("1", "true", "yes", "on")


def captcha_configured() -> bool:
    return bool(os.getenv("SSC_TURNSTILE_SECRET", "").strip())


def turnstile_site_key() -> str | None:
    key = os.getenv("SSC_TURNSTILE_SITE_KEY", "").strip()
    return key or None


def captcha_public_config() -> dict:
    required = captcha_required()
    site_key = turnstile_site_key()
    return {
        "captcha_required": required,
        "turnstile_site_key": site_key if required and site_key else None,
    }


async def verify_captcha(token: str | None, remote_ip: str | None = None) -> tuple[bool, str]:
    if not captcha_required():
        return True, ""
    secret = os.getenv("SSC_TURNSTILE_SECRET", "").strip()
    if not secret:
        return False, "captcha_not_configured"
    if not token or not token.strip():
        return False, "captcha_required"

    payload: dict[str, str] = {"secret": secret, "response": token.strip()}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(_TURNSTILE_VERIFY_URL, data=payload)
        data = resp.json()
    except httpx.HTTPError:
        return False, "captcha_unreachable"

    if data.get("success"):
        return True, ""
    return False, "captcha_invalid"