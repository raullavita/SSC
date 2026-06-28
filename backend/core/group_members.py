"""Group conversation member add/remove helpers."""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from core.contact_helpers import PEER_ROSTER_FIELDS, are_contacts
from core.database import db
from core.last_seen import project_user_for_peer
from core.conversation_meta import peer_summary, sanitize_conversation_for_api
from core.conversation_pins import clear_pins_for_conversation
from core.push_helpers import send_push_for_group_added
from core.realtime import manager
from core.utils import iso, now_utc


async def _member_map(participant_ids: List[str]) -> Dict[str, dict]:
    users = await db.users.find(
        {"user_id": {"$in": participant_ids}},
        PEER_ROSTER_FIELDS,
    ).to_list(100)
    return {u["user_id"]: peer_summary(u) for u in users}


async def _broadcast_conv_update(conv: dict, *, exclude_user_id: Optional[str] = None) -> None:
    member_map = await _member_map(conv.get("participants", []))
    for pid in conv.get("participants", []):
        if pid == exclude_user_id:
            continue
        members = [
            member_map[uid]
            for uid in conv["participants"]
            if uid != pid and uid in member_map
        ]
        payload = sanitize_conversation_for_api({**conv, "members": members}, pid)
        await manager.send_to_user(pid, {"type": "conversation-updated", "data": payload})


async def add_group_members(
    conv: dict,
    *,
    actor_id: str,
    peer_docs: List[dict],
) -> dict:
    participants = list(conv.get("participants", []))
    added_ids: List[str] = []
    for peer in peer_docs:
        uid = peer["user_id"]
        if uid in participants:
            continue
        if not await are_contacts(actor_id, uid):
            raise ValueError(f"Must be mutual contacts with {peer['username']}")
        participants.append(uid)
        added_ids.append(uid)
    if not added_ids:
        return conv
    participants = sorted(set(participants))
    await db.conversations.update_one(
        {"conversation_id": conv["conversation_id"]},
        {"$set": {"participants": participants, "updated_at": iso(now_utc())}},
    )
    conv = {**conv, "participants": participants}
    await _broadcast_conv_update(conv)
    actor = await db.users.find_one({"user_id": actor_id}, PEER_ROSTER_FIELDS)
    for pid in added_ids:
        asyncio.create_task(send_push_for_group_added(pid, actor or {"user_id": actor_id}, conv))
    return conv


async def remove_group_member(
    conv: dict,
    *,
    target_user_id: str,
    actor_id: str,
) -> Optional[dict]:
    participants = [p for p in conv.get("participants", []) if p != target_user_id]
    if len(participants) == len(conv.get("participants", [])):
        return conv
    if len(participants) < 2:
        await db.messages.delete_many({"conversation_id": conv["conversation_id"]})
        await db.message_reads.delete_many({"conversation_id": conv["conversation_id"]})
        await clear_pins_for_conversation(conv["conversation_id"])
        await db.conversations.delete_one({"conversation_id": conv["conversation_id"]})
        for pid in conv.get("participants", []):
            await manager.send_to_user(pid, {
                "type": "conversation-deleted",
                "data": {"conversation_id": conv["conversation_id"]},
            })
        return None
    await db.conversations.update_one(
        {"conversation_id": conv["conversation_id"]},
        {"$set": {"participants": participants, "updated_at": iso(now_utc())}},
    )
    conv = {**conv, "participants": participants}
    await _broadcast_conv_update(conv)
    await manager.send_to_user(target_user_id, {
        "type": "conversation-deleted",
        "data": {"conversation_id": conv["conversation_id"]},
    })
    return conv