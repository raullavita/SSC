"""Native push token registration helpers — Engine 4."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from db import get_database


async def register_push_token(
    user_id: str,
    token: str,
    platform: str,
) -> dict[str, Any]:
    db = get_database()
    doc = {
        "user_id": user_id,
        "token": token,
        "platform": platform,
        "updated_at": datetime.now(timezone.utc),
    }
    await db.push_tokens.delete_many({"token": token, "user_id": {"$ne": user_id}})
    await db.push_tokens.update_one(
        {"token": token},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "platform": platform}