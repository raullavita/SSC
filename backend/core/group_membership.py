"""Group membership mutations — leave, remove, dissolve."""

from __future__ import annotations

from datetime import datetime, timezone

from core.group_policy import MIN_GROUP_MEMBERS


async def _sync_group_conversation(db, group_id: str, member_ids: list[str]) -> None:
    now = datetime.now(timezone.utc)
    await db.conversations.update_one(
        {"group_id": group_id},
        {"$set": {"participants": sorted(member_ids), "updated_at": now}},
    )


async def leave_group(db, group_id: str, user_id: str) -> dict:
    group = await db.groups.find_one({"_id": group_id, "member_ids": user_id})
    if not group:
        return {"error": "group_not_found"}

    members = list(group.get("member_ids", []))
    if user_id not in members:
        return {"error": "not_a_member"}

    if len(members) <= 1:
        return await dissolve_group(db, group_id, user_id)

    members.remove(user_id)
    owner_id = group.get("owner_id")
    updates: dict = {"member_ids": sorted(members)}
    if owner_id == user_id:
        updates["owner_id"] = members[0]

    await db.groups.update_one({"_id": group_id}, {"$set": updates})
    await db.group_members.delete_one({"_id": f"{group_id}:{user_id}"})
    await _sync_group_conversation(db, group_id, members)

    updated = await db.groups.find_one({"_id": group_id})
    return {"action": "left", "group": updated, "dissolved": False}


async def remove_group_member(db, group_id: str, actor_id: str, target_id: str) -> dict:
    group = await db.groups.find_one({"_id": group_id, "member_ids": actor_id})
    if not group:
        return {"error": "group_not_found"}
    if group.get("owner_id") != actor_id:
        return {"error": "owner_only"}
    if target_id == actor_id:
        return {"error": "cannot_remove_self_use_leave"}

    members = list(group.get("member_ids", []))
    if target_id not in members:
        return {"error": "member_not_found"}

    if len(members) - 1 < MIN_GROUP_MEMBERS:
        return await dissolve_group(db, group_id, actor_id)

    members.remove(target_id)
    await db.groups.update_one({"_id": group_id}, {"$set": {"member_ids": sorted(members)}})
    await db.group_members.delete_one({"_id": f"{group_id}:{target_id}"})
    await _sync_group_conversation(db, group_id, members)

    updated = await db.groups.find_one({"_id": group_id})
    return {"action": "removed", "group": updated, "removed_user_id": target_id, "dissolved": False}


async def dissolve_group(db, group_id: str, actor_id: str) -> dict:
    group = await db.groups.find_one({"_id": group_id, "member_ids": actor_id})
    if not group:
        return {"error": "group_not_found"}
    if group.get("owner_id") != actor_id:
        return {"error": "owner_only"}

    await db.group_members.delete_many({"group_id": group_id})
    await db.groups.delete_one({"_id": group_id})
    now = datetime.now(timezone.utc)
    await db.conversations.update_one(
        {"group_id": group_id},
        {"$set": {"participants": [], "updated_at": now, "dissolved": True}},
    )
    return {"action": "dissolved", "group_id": group_id, "dissolved": True}