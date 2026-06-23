"""Conversation metadata minimization — Engine 1 Step 1.4."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from core.utils import iso

GENERIC_GROUP_LABEL = "Group"

# Fields stored on conversation documents (no user-chosen titles, no previews).
CONVERSATION_STORE_FIELDS = (
    "conversation_id",
    "participants",
    "is_group",
    "admin_id",
    "created_at",
    "created_by",
    "last_activity_at",
    "expires_at",
)


def group_display_label(participant_count: int) -> str:
    return f"{GENERIC_GROUP_LABEL} ({participant_count})"


def last_activity_from_message(msg: Optional[dict]) -> dict:
    """Sidebar-safe summary — no ciphertext, keys, or sender handles."""
    if not msg:
        return {"has_messages": False, "last_message_at": None, "last_message_type": None}
    created = msg.get("created_at")
    if isinstance(created, datetime):
        created = iso(created)
    return {
        "has_messages": True,
        "last_message_at": created,
        "last_message_type": msg.get("message_type") or "text",
    }


def project_message_for_viewer(msg: dict, viewer_id: str) -> dict:
    """Re-export — canonical implementation in core.api_integrity (Engine 2.4)."""
    from core.api_integrity import project_message_for_viewer as _project
    return _project(msg, viewer_id)


def peer_summary(user: Optional[dict]) -> Optional[dict]:
    if not user:
        return None
    return {
        "user_id": user.get("user_id"),
        "username": user.get("username"),
        "language": user.get("language"),
        "public_key": user.get("public_key"),
        "avatar": user.get("avatar"),
        "last_seen": user.get("last_seen"),
    }


def sanitize_conversation_for_api(conv: dict, viewer_id: str) -> dict:
    """Strip storage fields; never expose custom group titles or message blobs."""
    if not conv:
        return conv
    out = {
        "conversation_id": conv["conversation_id"],
        "participants": conv.get("participants", []),
        "is_group": bool(conv.get("is_group")),
        "created_at": conv.get("created_at"),
        "last_activity_at": conv.get("last_activity_at"),
        "expires_at": conv.get("expires_at"),
    }
    if isinstance(out.get("expires_at"), datetime):
        out["expires_at"] = iso(out["expires_at"])
    if conv.get("is_group"):
        out["display_label"] = group_display_label(len(out["participants"]))
        out["admin_id"] = conv.get("admin_id")
        out["members"] = conv.get("members") or []
        out["peer"] = None
    else:
        out["peer"] = conv.get("peer")
        out["display_label"] = None
    if "last_activity" in conv:
        out["last_activity"] = conv["last_activity"]
    return out