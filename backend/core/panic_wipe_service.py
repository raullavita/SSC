"""
Server panic wipe — erases chat/call/file footprint; preserves account + social graph.

Preserves: users, contacts, friend_requests (RETENTION_CHARTER wife scenario).
Wipes: conversations, messages (sent + received), files (owned + attachments in those chats),
statuses, call records, sessions, push endpoints.
"""
from __future__ import annotations

from typing import Any, Dict, Optional, Set

from core.auth import jwt_ttl_seconds
from core.database import db
from core.files import delete_file_gridfs
from core.logging_config import logger
from core.logging_policy import safe_exception_label
from core.token_revocation import revoke_token

# Mongo collections intentionally NOT modified by panic wipe.
PANIC_PRESERVE_COLLECTIONS = frozenset({"users", "contacts", "friend_requests"})

# Collections panic wipe may delete from (audit / gate tests).
PANIC_WIPE_COLLECTIONS = frozenset({
    "conversations",
    "messages",
    "message_reads",
    "files",
    "statuses",
    "calls",
    "user_sessions",
    "push_subscriptions",
    "native_push_tokens",
})


async def _conversation_ids_for_user(user_id: str) -> list[str]:
    convs = await db.conversations.find(
        {"participants": user_id},
        {"_id": 0, "conversation_id": 1},
    ).to_list(10_000)
    return [c["conversation_id"] for c in convs if c.get("conversation_id")]


async def _attachment_ids_in_conversations(conv_ids: list[str]) -> Set[str]:
    if not conv_ids:
        return set()
    ids: Set[str] = set()
    cursor = db.messages.find(
        {
            "conversation_id": {"$in": conv_ids},
            "attachment_id": {"$exists": True, "$ne": None},
        },
        {"_id": 0, "attachment_id": 1},
    )
    async for msg in cursor:
        aid = msg.get("attachment_id")
        if aid:
            ids.add(aid)
    return ids


async def _attachment_ids_on_statuses(user_id: str) -> Set[str]:
    ids: Set[str] = set()
    cursor = db.statuses.find(
        {"author_id": user_id, "attachment_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "attachment_id": 1},
    )
    async for status in cursor:
        aid = status.get("attachment_id")
        if aid:
            ids.add(aid)
    return ids


async def _mark_file_deleted(file_id: str) -> bool:
    record = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        return False
    try:
        await delete_file_gridfs(file_id)
    except Exception as e:
        logger.warning(
            f"panic-wipe gridfs delete failed file={file_id}: {safe_exception_label(e)}"
        )
    await db.files.update_one({"file_id": file_id}, {"$set": {"is_deleted": True}})
    return True


async def _wipe_files_for_user(user_id: str, extra_file_ids: Set[str]) -> int:
    wiped = 0
    seen: Set[str] = set()

    owner_files = await db.files.find(
        {"owner_id": user_id, "is_deleted": False},
        {"_id": 0, "file_id": 1},
    ).to_list(10_000)
    for row in owner_files:
        fid = row.get("file_id")
        if fid and fid not in seen:
            seen.add(fid)
            if await _mark_file_deleted(fid):
                wiped += 1

    for fid in extra_file_ids:
        if fid in seen:
            continue
        seen.add(fid)
        if await _mark_file_deleted(fid):
            wiped += 1

    return wiped


async def execute_server_panic_wipe(
    user_id: str,
    *,
    session_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Wipe ephemeral server footprint for user_id. Account and contacts remain."""
    logger.warning(f"panic-wipe executed for user={user_id}")

    conv_ids = await _conversation_ids_for_user(user_id)
    attachment_ids = await _attachment_ids_in_conversations(conv_ids)
    attachment_ids |= await _attachment_ids_on_statuses(user_id)

    wiped_messages = 0
    if conv_ids:
        msg_res = await db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
        wiped_messages = msg_res.deleted_count
        await db.message_reads.delete_many({"conversation_id": {"$in": conv_ids}})
        await db.conversations.delete_many({"conversation_id": {"$in": conv_ids}})

    status_res = await db.statuses.delete_many({"author_id": user_id})
    await db.message_reads.delete_many({"user_id": user_id})

    wiped_files = await _wipe_files_for_user(user_id, attachment_ids)

    call_res = await db.calls.delete_many({
        "$or": [
            {"caller_id": user_id},
            {"callee_id": user_id},
            {"participants": user_id},
            {"user_id": user_id},
        ]
    })

    session_res = await db.user_sessions.delete_many({"user_id": user_id})
    push_res = await db.push_subscriptions.delete_many({"user_id": user_id})
    native_res = await db.native_push_tokens.delete_many({"user_id": user_id})

    if session_token:
        revoke_token(session_token, jwt_ttl_seconds(session_token))

    return {
        "ok": True,
        "wiped_conversations": len(conv_ids),
        "wiped_messages": wiped_messages,
        "wiped_files": wiped_files,
        "wiped_statuses": status_res.deleted_count,
        "wiped_calls": call_res.deleted_count,
        "wiped_sessions": session_res.deleted_count,
        "wiped_push_subscriptions": push_res.deleted_count,
        "wiped_native_push_tokens": native_res.deleted_count,
        "preserved_collections": sorted(PANIC_PRESERVE_COLLECTIONS),
    }