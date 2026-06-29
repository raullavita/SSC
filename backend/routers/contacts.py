"""
Contacts / Friend Requests router — server-blind graph (contact_graph.py).
"""
import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_graph import (
    are_contacts,
    establish_mutual_contact,
    get_roster_contact_ids,
    get_roster_prefs,
    is_blocked_pair,
    remove_mutual_contact,
    seal_exists,
    set_block,
    set_mute,
)
from core.database import db
from core.logging_config import logger
from core.conversation_mutes import mute_conversation_for_user, unmute_conversation_for_user
from core.models import ConversationMuteIn, FriendRequestActionIn, SendFriendRequestIn
from core.contact_realtime import (
    notify_contacts_changed,
    notify_friend_accepted,
    notify_friend_rejected,
    notify_friend_request,
    notify_friend_request_sent,
)
from core.push_helpers import send_push_for_friend_accept, send_push_for_friend_request
from core.retention import friend_request_pending_expires_at, friend_request_resolved_expires_at
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


@router.post("/request")
async def send_friend_request(body: SendFriendRequestIn, current=Depends(get_current_user)):
    if not rate_limit_check(
        f"friendreq:burst:{current['user_id']}",
        max_hits=5,
        window_sec=300,
        limiter="friend_request_burst",
    ):
        logger.warning(f"rate-limit friend-request burst user={current['user_id']}")
        raise HTTPException(429, "Too many friend requests recently")
    if not rate_limit_check(
        f"friendreq:daily:{current['user_id']}",
        max_hits=40,
        window_sec=86400,
        limiter="friend_request_daily",
    ):
        logger.warning(f"rate-limit friend-request user={current['user_id']}")
        raise HTTPException(429, "Friend request limit reached for today")

    target = await db.users.find_one({"username": body.username}, {"_id": 0, "user_id": 1, "username": 1})
    if not target:
        raise HTTPException(404, "User not found")
    if target["user_id"] == current["user_id"]:
        raise HTTPException(400, "Cannot send request to yourself")

    if await are_contacts(current["user_id"], target["user_id"]):
        return {"ok": True, "message": "Already contacts"}

    if await is_blocked_pair(current["user_id"], target["user_id"]):
        raise HTTPException(403, "Cannot send request - blocked")

    existing = await db.friend_requests.find_one({
        "$or": [
            {"from_user_id": current["user_id"], "to_user_id": target["user_id"], "status": "pending"},
            {"from_user_id": target["user_id"], "to_user_id": current["user_id"], "status": "pending"},
        ]
    })
    if existing:
        return {"ok": True, "message": "Request already pending"}

    req_id = f"fr_{uuid.uuid4().hex[:14]}"
    await db.friend_requests.insert_one({
        "request_id": req_id,
        "from_user_id": current["user_id"],
        "from_username": current["username"],
        "to_user_id": target["user_id"],
        "to_username": target["username"],
        "status": "pending",
        "created_at": iso(now_utc()),
        "expires_at": friend_request_pending_expires_at(),
    })
    await notify_friend_request(
        target["user_id"],
        request_id=req_id,
        from_user_id=current["user_id"],
        from_username=current["username"],
    )
    await notify_friend_request_sent(
        current["user_id"],
        request_id=req_id,
        to_user_id=target["user_id"],
        to_username=target["username"],
    )
    asyncio.create_task(send_push_for_friend_request(target["user_id"], current))
    return {"ok": True, "request_id": req_id}


@router.get("/requests")
async def list_pending_requests(current=Depends(get_current_user)):
    incoming = await db.friend_requests.find(
        {"to_user_id": current["user_id"], "status": "pending"},
        {"_id": 0},
    ).to_list(100)
    return incoming


@router.get("/requests/sent")
async def list_sent_requests(current=Depends(get_current_user)):
    outgoing = await db.friend_requests.find(
        {"from_user_id": current["user_id"], "status": "pending"},
        {"_id": 0},
    ).to_list(100)
    return outgoing


@router.post("/requests/accept")
async def accept_friend_request(body: FriendRequestActionIn, current=Depends(get_current_user)):
    req = await db.friend_requests.find_one({
        "request_id": body.request_id,
        "to_user_id": current["user_id"],
        "status": "pending",
    })
    if not req:
        raise HTTPException(404, "Request not found or already handled")

    await db.friend_requests.update_one(
        {"request_id": body.request_id},
        {"$set": {"status": "accepted", "expires_at": friend_request_resolved_expires_at()}},
    )
    logger.info(f"friend request accepted: {body.request_id} by {current['user_id']}")

    await establish_mutual_contact(req["from_user_id"], req["to_user_id"])

    await notify_friend_accepted(
        req["from_user_id"],
        current["user_id"],
        request_id=body.request_id,
        accepter_username=current["username"],
    )
    asyncio.create_task(send_push_for_friend_accept(req["from_user_id"], current))
    return {"ok": True}


@router.post("/requests/reject")
async def reject_friend_request(body: FriendRequestActionIn, current=Depends(get_current_user)):
    req = await db.friend_requests.find_one({
        "request_id": body.request_id,
        "to_user_id": current["user_id"],
        "status": "pending",
    })
    if not req:
        raise HTTPException(404, "Request not found or already handled")

    await db.friend_requests.update_one(
        {"request_id": body.request_id},
        {"$set": {"status": "rejected", "expires_at": friend_request_resolved_expires_at()}},
    )
    logger.info(f"friend request rejected: {body.request_id} by {current['user_id']}")
    await notify_friend_rejected(req["from_user_id"], current["user_id"], request_id=body.request_id)
    return {"ok": True}


@router.get("")
async def list_contacts(current=Depends(get_current_user)):
    contact_ids = await get_roster_contact_ids(current["user_id"])
    if not contact_ids:
        return []
    from core.last_seen import project_user_for_peer

    from core.contact_helpers import PEER_ROSTER_FIELDS

    users = await db.users.find(
        {"user_id": {"$in": contact_ids}},
        PEER_ROSTER_FIELDS,
    ).to_list(500)
    user_map = {u["user_id"]: u for u in users}
    result = []
    for contact_id in contact_ids:
        prefs = await get_roster_prefs(current["user_id"], contact_id)
        blocked_by_me = prefs.get("blocked", False)
        # Keep blocked contacts in roster so unblock UI works (are_contacts is false when blocked).
        if blocked_by_me:
            if not await seal_exists(current["user_id"], contact_id):
                continue
        elif not await are_contacts(current["user_id"], contact_id):
            continue
        u = project_user_for_peer(user_map.get(contact_id))
        if not u:
            continue
        entry = {
            **u,
            "blocked": blocked_by_me,
            "muted": prefs.get("muted", False),
        }
        if prefs.get("muted_until"):
            entry["muted_until"] = prefs["muted_until"]
        result.append(entry)
    return result


@router.delete("/{contact_user_id}")
async def remove_contact(contact_user_id: str, current=Depends(get_current_user)):
    await remove_mutual_contact(current["user_id"], contact_user_id)
    return {"ok": True}


@router.post("/{contact_user_id}/block")
async def block_contact(contact_user_id: str, current=Depends(get_current_user)):
    await set_block(current["user_id"], contact_user_id, blocked_flag=True)
    logger.info(f"user blocked contact: {current['user_id']} blocked {contact_user_id}")
    asyncio.create_task(notify_contacts_changed(current["user_id"], reason="block"))
    return {"ok": True}


@router.post("/{contact_user_id}/unblock")
async def unblock_contact(contact_user_id: str, current=Depends(get_current_user)):
    await set_block(current["user_id"], contact_user_id, blocked_flag=False)
    asyncio.create_task(notify_contacts_changed(current["user_id"], reason="unblock"))
    return {"ok": True}


@router.post("/{contact_user_id}/mute")
async def mute_contact(
    contact_user_id: str,
    body: ConversationMuteIn = ConversationMuteIn(),
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one(
        {
            "participants": {"$all": [current["user_id"], contact_user_id]},
            "is_group": {"$ne": True},
        },
        {"_id": 0, "conversation_id": 1},
    )
    if conv:
        await mute_conversation_for_user(
            current["user_id"],
            conv["conversation_id"],
            duration=body.duration,
        )
    else:
        from core.mute_duration import muted_until_from_duration

        muted_until = muted_until_from_duration(body.duration)
        await set_mute(
            current["user_id"],
            contact_user_id,
            muted_flag=True,
            muted_until=muted_until,
        )
    asyncio.create_task(notify_contacts_changed(current["user_id"], reason="mute"))
    return {"ok": True}


@router.post("/{contact_user_id}/unmute")
async def unmute_contact(contact_user_id: str, current=Depends(get_current_user)):
    conv = await db.conversations.find_one(
        {
            "participants": {"$all": [current["user_id"], contact_user_id]},
            "is_group": {"$ne": True},
        },
        {"_id": 0, "conversation_id": 1},
    )
    if conv:
        await unmute_conversation_for_user(current["user_id"], conv["conversation_id"])
    else:
        await set_mute(current["user_id"], contact_user_id, muted_flag=False)
    asyncio.create_task(notify_contacts_changed(current["user_id"], reason="unmute"))
    return {"ok": True}