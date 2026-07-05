"""Rich metadata-minimal push — kind labels + optional conversation title — P2#12."""

from __future__ import annotations

from typing import Any

PUSH_KIND_LABELS: dict[str, str] = {
    "message": "New message",
    "attachment": "New attachment",
    "poll": "New poll",
    "reaction": "New reaction",
    "sender_key_distribution": "New message",
}

ALLOWED_PUSH_DATA_KEYS = frozenset(
    {
        "type",
        "silent_meta",
        "kind",
        "conversation_id",
        "message_id",
        "call_id",
        "conversation_label",
    }
)


def push_body_for_kind(kind: str | None) -> str:
    return PUSH_KIND_LABELS.get(kind or "message", PUSH_KIND_LABELS["message"])


def sanitize_push_label(label: str | None, *, max_len: int = 48) -> str | None:
    if not label:
        return None
    cleaned = " ".join(str(label).split())
    if not cleaned:
        return None
    return cleaned[:max_len]


async def resolve_conversation_label(
    db,
    *,
    conversation_id: str,
    recipient_id: str,
) -> str | None:
    conv = await db.conversations.find_one({"_id": conversation_id})
    if not conv:
        return None
    if conv.get("type") == "group":
        title = conv.get("title") or conv.get("name")
        return sanitize_push_label(title) or "Group chat"
    participants = conv.get("participants") or []
    peer_id = next((p for p in participants if p != recipient_id), None)
    if not peer_id:
        return None
    user = await db.users.find_one({"_id": peer_id}, {"display_name": 1})
    return sanitize_push_label((user or {}).get("display_name")) or "Contact"


def merge_push_data(base: dict[str, Any], extra: dict[str, Any] | None) -> dict[str, str]:
    data = {k: str(v) for k, v in base.items()}
    if not extra:
        return data
    for key, value in extra.items():
        if key in ALLOWED_PUSH_DATA_KEYS and value is not None:
            data[key] = str(value)
    return data