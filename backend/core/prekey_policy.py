"""Prekey fetch policy — relationship check before bundle download (Tier D2)."""

from __future__ import annotations


async def prekey_fetch_allowed(db, viewer_id: str, target_user_id: str) -> bool:
    """Allow own devices, existing direct chats, or accepted friend requests."""
    if viewer_id == target_user_id:
        return True

    conv = await db.conversations.find_one(
        {
            "type": "direct",
            "participants": {"$all": [viewer_id, target_user_id]},
        }
    )
    if conv:
        return True

    accepted = await db.friend_requests.find_one(
        {
            "status": "accepted",
            "$or": [
                {"from_user_id": viewer_id, "to_user_id": target_user_id},
                {"from_user_id": target_user_id, "to_user_id": viewer_id},
            ],
        }
    )
    return accepted is not None