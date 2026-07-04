"""Panic wipe service — immediate deletion of all user data (Engine 1)."""

from __future__ import annotations

from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.retention_policy import COLLECTIONS


def _build_filter(policy_name: str, user_id: str) -> dict[str, Any] | None:
    policy = COLLECTIONS[policy_name]
    if not policy.panic_field:
        return None

    field = policy.panic_field
    if policy.panic_match == "object_id":
        try:
            return {field: ObjectId(user_id)}
        except Exception:
            return {field: user_id}
    if policy.panic_match == "contains":
        return {field: user_id}
    return {field: user_id}


async def panic_wipe_user(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, int]:
    """
    Delete all server-side data for a user across every collection in the retention policy.
    Returns per-collection delete counts.
    """
    counts: dict[str, int] = {}

    # Wipe conversations and dependent message rows first.
    conv_ids: list[Any] = []
    conv_cursor = db["conversations"].find({"participants": user_id}, {"_id": 1})
    async for doc in conv_cursor:
        conv_ids.append(doc["_id"])

    if conv_ids:
        msg_result = await db["messages"].delete_many({"conversation_id": {"$in": conv_ids}})
        counts["messages"] = msg_result.deleted_count

    for name in sorted(COLLECTIONS.keys()):
        if name == "messages" and "messages" in counts:
            continue

        filt = _build_filter(name, user_id)
        if filt is None:
            continue

        if name == "friend_requests":
            coll = db[name]
            result_from = await coll.delete_many({"from_user_id": user_id})
            result_to = await coll.delete_many({"to_user_id": user_id})
            counts[name] = result_from.deleted_count + result_to.deleted_count
            continue

        result = await db[name].delete_many(filt)
        counts[name] = result.deleted_count

    return counts


async def panic_wipe_user_and_report(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any]:
    counts = await panic_wipe_user(db, user_id)
    total = sum(counts.values())
    return {"user_id": user_id, "deleted": counts, "total": total}