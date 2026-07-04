"""Group chat policy — Engine 9."""

from __future__ import annotations

import os
from typing import Any

MAX_GROUP_MEMBERS = int(os.getenv("SSC_MAX_GROUP_MEMBERS", "256"))
MIN_GROUP_MEMBERS = 2


def public_group(doc: dict[str, Any], viewer_id: str) -> dict[str, Any]:
    members = doc.get("member_ids", [])
    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    return {
        "id": doc["_id"],
        "name": doc.get("name", ""),
        "member_count": len(members),
        "is_member": viewer_id in members,
        "created_at": created,
    }


def public_group_conversation(doc: dict[str, Any], viewer_id: str, meta: dict | None = None) -> dict[str, Any]:
    updated = doc.get("updated_at")
    if hasattr(updated, "isoformat"):
        updated = updated.isoformat()
    out: dict[str, Any] = {
        "id": doc["_id"],
        "type": "group",
        "group_id": doc.get("group_id"),
        "updated_at": updated,
    }
    if meta:
        out["pinned"] = bool(meta.get("pinned"))
        out["muted"] = bool(meta.get("muted"))
        if meta.get("unread_count") is not None:
            out["unread_count"] = int(meta["unread_count"])
    _ = viewer_id
    return out


def engine9_group_ready() -> bool:
    return MAX_GROUP_MEMBERS >= MIN_GROUP_MEMBERS