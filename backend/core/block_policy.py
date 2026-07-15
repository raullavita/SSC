"""Bidirectional block checks for contact surfaces (DM, prekeys, calls, friend requests)."""

from __future__ import annotations

from core.abuse_enforcement import is_user_blocked


async def interaction_blocked(db, actor_id: str, other_id: str) -> tuple[bool, str | None]:
    """Return (blocked, detail) when either party has blocked the other."""
    if actor_id == other_id:
        return False, None
    if await is_user_blocked(db, other_id, actor_id):
        return True, "blocked_by_recipient"
    if await is_user_blocked(db, actor_id, other_id):
        return True, "you_blocked_user"
    return False, None


async def reachable_participants(db, actor_id: str, participant_ids: list[str]) -> list[str]:
    """Participants the actor can still reach (not blocked in either direction)."""
    reachable: list[str] = []
    for other_id in participant_ids:
        if other_id == actor_id:
            continue
        blocked, _ = await interaction_blocked(db, actor_id, other_id)
        if not blocked:
            reachable.append(other_id)
    return reachable