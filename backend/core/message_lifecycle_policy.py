"""Message lifecycle policy — edit, delete, forward — Step 12."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

EDIT_WINDOW_SECONDS = 15 * 60
DELETE_FOR_EVERYONE_WINDOW_SECONDS = 60 * 60

DELETE_SCOPES = frozenset({"me", "everyone"})
EDITABLE_MESSAGE_KINDS = frozenset({"message", None})


def _age_seconds(doc: dict[str, Any], now: datetime) -> float:
    created = doc.get("created_at")
    if not created:
        return float("inf")
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return (now - created).total_seconds()


def can_edit_message(doc: dict[str, Any], user_id: str, now: datetime | None = None) -> tuple[bool, str]:
    now = now or datetime.now(timezone.utc)
    if doc.get("message_kind") == "deleted":
        return False, "message_deleted"
    if doc.get("sender_id") != user_id:
        return False, "not_message_sender"
    if doc.get("message_kind") not in EDITABLE_MESSAGE_KINDS:
        return False, "message_not_editable"
    if _age_seconds(doc, now) > EDIT_WINDOW_SECONDS:
        return False, "edit_window_expired"
    return True, ""


def can_delete_for_me(doc: dict[str, Any], user_id: str) -> tuple[bool, str]:
    if user_id in doc.get("deleted_for", []):
        return False, "already_deleted"
    return True, ""


def can_delete_for_everyone(doc: dict[str, Any], user_id: str, now: datetime | None = None) -> tuple[bool, str]:
    now = now or datetime.now(timezone.utc)
    if doc.get("message_kind") == "deleted":
        return False, "message_deleted"
    if doc.get("sender_id") != user_id:
        return False, "not_message_sender"
    if _age_seconds(doc, now) > DELETE_FOR_EVERYONE_WINDOW_SECONDS:
        return False, "delete_window_expired"
    return True, ""


def is_hidden_for_viewer(doc: dict[str, Any], viewer_id: str | None) -> bool:
    if not viewer_id:
        return False
    return viewer_id in doc.get("deleted_for", [])


def is_tombstone(doc: dict[str, Any]) -> bool:
    return doc.get("message_kind") == "deleted"


def tombstone_update(now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    return {
        "message_kind": "deleted",
        "ciphertext": "",
        "protocol": "deleted_v1",
        "deleted_at": now,
        "reply_to": None,
        "poll_id": None,
        "forwarded_from": None,
    }


def step12_message_lifecycle_ready() -> bool:
    return bool(DELETE_SCOPES) and EDIT_WINDOW_SECONDS > 0