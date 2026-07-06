"""Short-lived WebSocket subscribe tokens (Phase 3)."""

from __future__ import annotations

import os
import re

from core.short_lived_tokens import consume_token, issue_token

_NAMESPACE = "ws_subscribe"
_DEFAULT_TTL = int(os.getenv("SSC_WS_SUBSCRIBE_TTL_SEC", "90"))
_TOPIC_RE = re.compile(r"^(user:[a-zA-Z0-9_-]+|conversation:[a-zA-Z0-9_-]+)$")


def _require_subscribe_token() -> bool:
    from config import get_settings

    default = "true" if get_settings().is_production else "false"
    raw = os.getenv("SSC_REQUIRE_WS_SUBSCRIBE_TOKEN", default).strip().lower()
    return raw in ("1", "true", "yes", "on")


def validate_topic_for_user(topic: str, user_id: str) -> bool:
    if not _TOPIC_RE.match(topic):
        return False
    if topic == f"user:{user_id}":
        return True
    return topic.startswith("conversation:")


async def issue_subscribe_token(user_id: str, topic: str) -> str:
    if not validate_topic_for_user(topic, user_id):
        raise ValueError("ws_subscribe_topic_forbidden")
    return await issue_token(
        _NAMESPACE,
        {"user_id": user_id, "topic": topic},
        _DEFAULT_TTL,
    )


async def consume_subscribe_token(token: str | None, user_id: str, topic: str) -> bool:
    if not token or not token.strip():
        return False
    record = await consume_token(_NAMESPACE, token.strip())
    if not record:
        return False
    return record.get("user_id") == user_id and record.get("topic") == topic


def ws_subscribe_token_required() -> bool:
    return _require_subscribe_token()