"""Conversation metadata minimization — Engine 1 Step 1.4."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from core.group_roles import roles_for_api
from core.member_joined import enrich_members_with_joined_at, member_joined_at_for_api
from core.group_topics import topics_for_api
from core.utils import iso

GENERIC_GROUP_LABEL = "Group"

# Fields stored on conversation documents (no user-chosen titles, no previews).
CONVERSATION_STORE_FIELDS = (
    "conversation_id",
    "participants",
    "is_group",
    "admin_id",
    "owner_id",
    "member_roles",
    "member_joined_at",
    "group_topics",
    "group_permissions",
    "group_photo",
    "group_description",
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
    from core.last_seen import project_user_for_peer
    return project_user_for_peer(user)


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
        role_fields = roles_for_api(conv)
        out["admin_id"] = role_fields["admin_id"]
        out["owner_id"] = role_fields["owner_id"]
        out["member_roles"] = role_fields["member_roles"]
        out["group_permissions"] = role_fields["group_permissions"]
        if conv.get("group_photo"):
            out["group_photo"] = conv["group_photo"]
        if conv.get("group_description"):
            out["group_description"] = conv["group_description"]
        out["group_topics"] = topics_for_api(conv)
        joined_map = member_joined_at_for_api(conv)
        out["member_joined_at"] = joined_map
        out["members"] = enrich_members_with_joined_at(conv.get("members") or [], joined_map)
        out["peer"] = None
    else:
        out["peer"] = conv.get("peer")
        out["display_label"] = None
    if "last_activity" in conv:
        out["last_activity"] = conv["last_activity"]
    out["pinned"] = bool(conv.get("pinned"))
    if conv.get("pinned_at"):
        pinned_at = conv["pinned_at"]
        if isinstance(pinned_at, datetime):
            pinned_at = iso(pinned_at)
        out["pinned_at"] = pinned_at
    out["archived"] = bool(conv.get("archived"))
    if conv.get("archived_at"):
        archived_at = conv["archived_at"]
        if isinstance(archived_at, datetime):
            archived_at = iso(archived_at)
        out["archived_at"] = archived_at
    out["muted"] = bool(conv.get("muted"))
    if conv.get("muted_until"):
        muted_until = conv["muted_until"]
        if isinstance(muted_until, datetime):
            muted_until = iso(muted_until)
        out["muted_until"] = muted_until
    return out