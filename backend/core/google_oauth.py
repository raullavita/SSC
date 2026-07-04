"""Google OAuth2 — authorization URL, code exchange, ID token verify."""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlencode

import httpx

GOOGLE_CLIENT_ID = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
GOOGLE_CLIENT_SECRET = (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()
GOOGLE_REDIRECT_URI = (os.getenv("GOOGLE_REDIRECT_URI") or "").strip()
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")


def google_oauth_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)


def build_google_auth_url(state: str) -> str:
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def exchange_code_for_profile(code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise ValueError("google_token_exchange_failed")
        tokens = token_resp.json()
        id_token = tokens.get("id_token")
        if id_token:
            info_resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
            if info_resp.status_code == 200:
                profile = info_resp.json()
                if profile.get("aud") != GOOGLE_CLIENT_ID:
                    raise ValueError("google_audience_mismatch")
                return {
                    "google_id": profile.get("sub"),
                    "email": (profile.get("email") or "").lower(),
                    "name": profile.get("name") or profile.get("email") or "SSC User",
                    "picture": profile.get("picture"),
                }
        access_token = tokens.get("access_token")
        if not access_token:
            raise ValueError("google_no_access_token")
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            raise ValueError("google_userinfo_failed")
        profile = user_resp.json()
        return {
            "google_id": profile.get("sub"),
            "email": (profile.get("email") or "").lower(),
            "name": profile.get("name") or profile.get("email") or "SSC User",
            "picture": profile.get("picture"),
        }


async def verify_id_token(id_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
        )
        if resp.status_code != 200:
            raise ValueError("invalid_google_id_token")
        profile = resp.json()
        if profile.get("aud") != GOOGLE_CLIENT_ID:
            raise ValueError("google_audience_mismatch")
        return {
            "google_id": profile.get("sub"),
            "email": (profile.get("email") or "").lower(),
            "name": profile.get("name") or profile.get("email") or "SSC User",
            "picture": profile.get("picture"),
        }