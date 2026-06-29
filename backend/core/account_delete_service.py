"""Permanent account deletion — purges all user data and removes the user record."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from core.auth import jwt_ttl_seconds
from core.contact_graph import block_seal, mute_seal, pair_seal, remove_mutual_contact, seal_exists
from core.database import db
from core.files import delete_file_gridfs
from core.logging_config import logger
from core.logging_policy import safe_exception_label
from core.panic_wipe_service import execute_server_panic_wipe
from core.token_revocation import revoke_token


async def _peer_ids_for_user(user_id: str) -> List[str]:
    all_users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(50_000)
    peers: List[str] = []
    for row in all_users:
        peer_id = row.get("user_id")
        if not peer_id or peer_id == user_id:
            continue
        if await seal_exists(user_id, peer_id):
            peers.append(peer_id)
    return peers


async def _purge_contact_graph(user_id: str, peer_ids: List[str]) -> int:
    detached = 0
    for peer_id in peer_ids:
        try:
            await remove_mutual_contact(peer_id, user_id)
            detached += 1
        except Exception as e:
            logger.warning(
                f"account-delete detach failed user={user_id} peer={peer_id}: {safe_exception_label(e)}"
            )
    for peer_id in peer_ids:
        await db.contact_seals.delete_one({"seal": pair_seal(user_id, peer_id)})
        await db.contact_blocks.delete_one({"seal": block_seal(user_id, peer_id)})
        await db.contact_blocks.delete_one({"seal": block_seal(peer_id, user_id)})
        await db.contact_mutes.delete_one({"seal": mute_seal(user_id, peer_id)})
        await db.contact_mutes.delete_one({"seal": mute_seal(peer_id, user_id)})
    r = await db.contact_rosters.delete_one({"user_id": user_id})
    await db.conversation_mutes.delete_many({"user_id": user_id})
    return detached + (1 if r.deleted_count else 0)


async def _delete_orphan_files(user_id: str) -> int:
    wiped = 0
    seen: Set[str] = set()
    cursor = db.files.find({"owner_id": user_id}, {"_id": 0, "file_id": 1})
    async for row in cursor:
        fid = row.get("file_id")
        if not fid or fid in seen:
            continue
        seen.add(fid)
        try:
            await delete_file_gridfs(fid)
        except Exception as e:
            logger.warning(f"account-delete gridfs failed file={fid}: {safe_exception_label(e)}")
        await db.files.delete_one({"file_id": fid})
        wiped += 1
    return wiped


async def execute_account_delete(
    user_id: str,
    *,
    session_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Wipe all server data for user_id and delete the account record."""
    logger.warning(f"account-delete executed for user={user_id}")

    panic_stats = await execute_server_panic_wipe(user_id, session_token=None)

    peer_ids = await _peer_ids_for_user(user_id)
    detached = await _purge_contact_graph(user_id, peer_ids)

    await db.broadcast_lists.delete_many({"owner_id": user_id})
    fr = await db.friend_requests.delete_many({
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}],
    })
    await db.signal_prekey_bundles.delete_many({"user_id": user_id})
    await db.signal_devices.delete_many({"user_id": user_id})
    await db.device_link_tokens.delete_many({"user_id": user_id})
    await db.sealed_delivery_tokens.delete_many({"issued_by": user_id})
    await db.passkey_credentials.delete_many({"user_id": user_id})
    try:
        await db.contacts.delete_many({"$or": [{"user_id": user_id}, {"contact_id": user_id}]})
    except Exception:
        pass

    extra_files = await _delete_orphan_files(user_id)
    user_res = await db.users.delete_one({"user_id": user_id})

    if session_token:
        revoke_token(session_token, jwt_ttl_seconds(session_token))

    return {
        "ok": True,
        "deleted_user": user_res.deleted_count > 0,
        "detached_contacts": detached,
        "wiped_friend_requests": fr.deleted_count,
        "extra_files_removed": extra_files,
        **{k: v for k, v in panic_stats.items() if k != "ok"},
    }