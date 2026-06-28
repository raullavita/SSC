"""@mention metadata for group messages — Q.17 (E2E body unchanged)."""
from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException

MAX_MENTIONED_USERS = 20


def normalize_mentioned_user_ids(value: Optional[List[str]]) -> List[str]:
    if not value:
        return []
    if len(value) > MAX_MENTIONED_USERS:
        raise HTTPException(400, f"Too many mentions (max {MAX_MENTIONED_USERS})")
    out: List[str] = []
    seen = set()
    for raw in value:
        uid = str(raw or "").strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        out.append(uid)
        if len(out) > MAX_MENTIONED_USERS:
            raise HTTPException(400, f"Too many mentions (max {MAX_MENTIONED_USERS})")
    return out


def validate_mentioned_users_for_group(
    *,
    is_group: bool,
    participant_ids: List[str],
    mentioned_user_ids: Optional[List[str]],
    sender_id: str,
) -> List[str]:
    if not is_group:
        return []
    normalized = normalize_mentioned_user_ids(mentioned_user_ids)
    if not normalized:
        return []
    participants = set(participant_ids or [])
    for uid in normalized:
        if uid not in participants:
            raise HTTPException(400, "Mentioned user is not in this group")
        if uid == sender_id:
            raise HTTPException(400, "Cannot mention yourself")
    return normalized