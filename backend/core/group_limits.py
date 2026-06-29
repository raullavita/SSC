"""Group size limits — Q.29 (chat groups up to 50 members)."""
from __future__ import annotations

from typing import Dict

from fastapi import HTTPException

MAX_GROUP_PARTICIPANTS = 50
MIN_GROUP_PARTICIPANTS = 2


def group_limits_public_config() -> Dict[str, int]:
    return {"max_participants": MAX_GROUP_PARTICIPANTS}


def remaining_group_slots(participant_count: int) -> int:
    return max(0, MAX_GROUP_PARTICIPANTS - int(participant_count or 0))


def is_group_full(participant_count: int) -> bool:
    return int(participant_count or 0) >= MAX_GROUP_PARTICIPANTS


def assert_group_size_allowed(participant_count: int) -> None:
    count = int(participant_count or 0)
    if count > MAX_GROUP_PARTICIPANTS:
        raise HTTPException(400, f"Groups can have at most {MAX_GROUP_PARTICIPANTS} members")
    if count < MIN_GROUP_PARTICIPANTS:
        raise HTTPException(400, "Group needs at least 2 members")


def assert_can_add_to_group(current_count: int, adding: int) -> None:
    if adding <= 0:
        return
    if int(current_count or 0) + adding > MAX_GROUP_PARTICIPANTS:
        raise HTTPException(400, f"Group is full (max {MAX_GROUP_PARTICIPANTS} members)")