from __future__ import annotations

from datetime import datetime, timezone


async def seed_accepted_friendship(fake_db, from_user_id: str, to_user_id: str) -> None:
    await fake_db.friend_requests.insert_one(
        {
            "_id": f"fr_{from_user_id}_{to_user_id}",
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "status": "accepted",
            "created_at": datetime.now(timezone.utc),
            "accepted_at": datetime.now(timezone.utc),
        }
    )
