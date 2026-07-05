"""Panic wipe service — user/device scoped deletion (Engine 1)."""

from __future__ import annotations

from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.retention_policy import COLLECTIONS

# Shared relay data — TTL handles cleanup; panic wipe must not remove others' chat history.
SKIP_PANIC_COLLECTIONS = frozenset({"messages", "polls"})

# Collections handled by detach helpers instead of delete_many.
DETACH_PANIC_COLLECTIONS = frozenset({"conversations", "call_sessions", "groups"})


def _build_filter(policy_name: str, user_id: str) -> dict[str, Any] | None:
    policy = COLLECTIONS[policy_name]
    if policy.panic_scope != "user_delete" or not policy.panic_field:
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


async def _detach_user_from_conversations(
    db: AsyncIOMotorDatabase, user_id: str
) -> dict[str, int]:
    """Remove user from shared threads without deleting peers' conversations."""
    pull_result = await db["conversations"].update_many(
        {"participants": user_id},
        {"$pull": {"participants": user_id}},
    )
    orphan_result = await db["conversations"].delete_many({"participants": {"$size": 0}})
    return {
        "conversations_detached": pull_result.modified_count,
        "conversations_orphaned_deleted": orphan_result.deleted_count,
    }


async def _detach_user_from_call_sessions(
    db: AsyncIOMotorDatabase, user_id: str
) -> dict[str, int]:
    pull_result = await db["call_sessions"].update_many(
        {"participants": user_id},
        {"$pull": {"participants": user_id}},
    )
    orphan_result = await db["call_sessions"].delete_many({"participants": {"$size": 0}})
    return {
        "call_sessions_detached": pull_result.modified_count,
        "call_sessions_orphaned_deleted": orphan_result.deleted_count,
    }


async def _detach_user_from_groups(
    db: AsyncIOMotorDatabase, user_id: str
) -> dict[str, int]:
    detached = 0
    dissolved = 0

    cursor = db["groups"].find({"member_ids": user_id})
    async for group in cursor:
        group_id = group["_id"]
        members = [m for m in group.get("member_ids", []) if m != user_id]
        if not members:
            await db["groups"].delete_one({"_id": group_id})
            dissolved += 1
            continue

        update: dict[str, Any] = {"$pull": {"member_ids": user_id}}
        if group.get("owner_id") == user_id:
            update["$set"] = {"owner_id": members[0]}
        await db["groups"].update_one({"_id": group_id}, update)
        detached += 1

    return {"groups_detached": detached, "groups_dissolved": dissolved}


async def panic_wipe_user(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, int]:
    """
    Delete server-side data scoped to the panicking user.

    Shared conversation relay (messages, polls) is left intact so other
    participants keep their chat history until TTL expiry.
    """
    counts: dict[str, int] = {}

    conv_counts = await _detach_user_from_conversations(db, user_id)
    counts.update(conv_counts)

    call_counts = await _detach_user_from_call_sessions(db, user_id)
    counts.update(call_counts)

    group_counts = await _detach_user_from_groups(db, user_id)
    counts.update(group_counts)

    for name in sorted(COLLECTIONS.keys()):
        if name in SKIP_PANIC_COLLECTIONS or name in DETACH_PANIC_COLLECTIONS:
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