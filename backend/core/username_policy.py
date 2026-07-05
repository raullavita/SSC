"""Username policy — discovery without phone numbers — Step 10."""

from __future__ import annotations

import re

USERNAME_RE = re.compile(r"^[a-z][a-z0-9_]{2,31}$")

RESERVED_USERNAMES: frozenset[str] = frozenset(
    {
        "admin",
        "api",
        "www",
        "support",
        "help",
        "root",
        "system",
        "null",
        "undefined",
        "supersecurechat",
        "ssc",
    }
)


def normalize_username(raw: str) -> str:
    return raw.strip().lstrip("@").lower()


def validate_username(raw: str) -> str | None:
    """Return error code string, or None if valid."""
    username = normalize_username(raw)
    if not username:
        return "username_required"
    if len(username) < 3 or len(username) > 32:
        return "username_length"
    if not USERNAME_RE.match(username):
        return "username_invalid"
    if username in RESERVED_USERNAMES:
        return "username_reserved"
    return None


def is_user_id_lookup(target: str) -> bool:
    return target.strip().startswith("u_")


def resolve_lookup_target(target: str) -> tuple[str, str]:
    """Return (kind, value) where kind is 'id' or 'username'."""
    raw = target.strip()
    if raw.startswith("@"):
        return "username", normalize_username(raw)
    if is_user_id_lookup(raw):
        return "id", raw
    lowered = raw.lower()
    if USERNAME_RE.match(lowered):
        return "username", lowered
    return "id", raw


def public_user_lookup(doc: dict, include_username: bool = True) -> dict:
    out = {
        "id": doc["_id"],
        "display_name": doc.get("display_name", ""),
    }
    if include_username and doc.get("username"):
        out["username"] = doc["username"]
    return out


def invite_web_path(username: str) -> str:
    return f"/add/{normalize_username(username)}"


def invite_web_url(username: str, base: str = "https://www.supersecurechat.com") -> str:
    return f"{base.rstrip('/')}{invite_web_path(username)}"


def engine10_username_policy_ready() -> bool:
    return bool(USERNAME_RE) and len(RESERVED_USERNAMES) > 0