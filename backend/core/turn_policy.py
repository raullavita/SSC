"""TURN/STUN ICE server policy — Step 3 / Engine 9."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Any

def _default_turn_enabled() -> str:
    prod = os.getenv("SSC_ENV", "development") == "production"
    return "true" if prod else "false"


TURN_ENABLED = os.getenv("SSC_TURN_ENABLED", _default_turn_enabled()).lower() in (
    "1",
    "true",
    "yes",
)
TURN_SECRET = (os.getenv("SSC_TURN_SECRET") or "").strip()
TURN_REALM = (os.getenv("SSC_TURN_REALM") or "supersecurechat.com").strip()
TURN_TTL_SECONDS = int(os.getenv("SSC_TURN_TTL_SECONDS", "86400"))
TURN_URIS = [
    u.strip()
    for u in (os.getenv("SSC_TURN_URIS") or "").split(",")
    if u.strip()
]
STUN_URIS = [
    u.strip()
    for u in (
        os.getenv("SSC_STUN_URIS")
        or "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
    ).split(",")
    if u.strip()
]

DEFAULT_DEV_STUN: list[dict[str, str]] = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
]


def _turn_password(username: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), username.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(digest).decode("ascii")


def turn_credentials_for_user(user_id: str) -> tuple[str, str, int]:
    """Ephemeral coturn credentials (REST API / use-auth-secret)."""
    expiry = int(time.time()) + TURN_TTL_SECONDS
    username = f"{expiry}:{user_id}"
    password = _turn_password(username, TURN_SECRET)
    return username, password, expiry


def build_ice_servers(user_id: str) -> dict[str, Any]:
    """
    Build RTCPeerConnection iceServers for the authenticated user.
    Returns STUN-only when TURN is disabled or misconfigured.
    """
    servers: list[dict[str, str]] = []

    for uri in STUN_URIS:
        servers.append({"urls": uri})

    turn_active = TURN_ENABLED and bool(TURN_SECRET) and bool(TURN_URIS)
    expires_at: int | None = None

    if turn_active:
        username, password, expires_at = turn_credentials_for_user(user_id)
        for uri in TURN_URIS:
            servers.append(
                {
                    "urls": uri,
                    "username": username,
                    "credential": password,
                }
            )

    if not servers:
        servers = list(DEFAULT_DEV_STUN)

    return {
        "ice_servers": servers,
        "turn_enabled": turn_active,
        "realm": TURN_REALM if turn_active else None,
        "ttl_seconds": TURN_TTL_SECONDS if turn_active else None,
        "expires_at": expires_at,
    }


def turn_policy_ready() -> bool:
    if TURN_ENABLED:
        return bool(TURN_SECRET) and bool(TURN_URIS)
    return bool(STUN_URIS)