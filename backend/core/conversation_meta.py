"""Per-user conversation metadata (pin/mute) — minimal fields — Engine 4."""

from __future__ import annotations

from typing import Any


async def get_meta_map(db, user_id: str, conversation_ids: list[str]) -> dict[str, dict]:
    if not conversation_ids:
        return {}
    cursor = db.conversation_meta.find(
        {"user_id": user_id, "conversation_id": {"$in": conversation_ids}}
    )
    out: dict[str, dict] = {}
    async for doc in cursor:
        out[doc["conversation_id"]] = {
            "pinned": bool(doc.get("pinned")),
            "muted": bool(doc.get("muted")),
            "unread_count": int(doc.get("unread_count", 0)),
        }
    return out


async def upsert_meta(
    db,
    user_id: str,
    conversation_id: str,
    *,
    pinned: bool | None = None,
    muted: bool | None = None,
) -> dict[str, Any]:
    updates: dict[str, Any] = {"user_id": user_id, "conversation_id": conversation_id}
    if pinned is not None:
        updates["pinned"] = pinned
    if muted is not None:
        updates["muted"] = muted

    existing = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    if existing:
        await db.conversation_meta.update_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            {"$set": updates},
        )
    else:
        updates.setdefault("pinned", False)
        updates.setdefault("muted", False)
        updates.setdefault("unread_count", 0)
        await db.conversation_meta.insert_one(updates)

    doc = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    return doc or updates