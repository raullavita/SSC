"""
Contacts / Friend Requests router.
"""
import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.contact_helpers import are_contacts
from core.database import db
from core.logging_config import logger
from core.models import FriendRequestActionIn, SendFriendRequestIn
from core.push_helpers import send_push_for_friend_accept, send_push_for_friend_request
from core.retention import friend_request_pending_expires_at, friend_request_resolved_expires_at
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


@router.post("/request")
async def send_friend_request(body: SendFriendRequestIn, current=Depends(get_current_user)):
    if not rate_limit_check(f"friendreq:{current['user_id']}", max_hits=5, window_sec=300):
        logger.warning(f"rate-limit friend-request user={current['user_id']}")
        raise HTTPException(429, "Too many friend requests recently")

    target = await db.users.find_one({"username": body.username}, {"_id": 0, "user_id": 1, "username": 1})
    if not target:
        raise HTTPException(404, "User not found")
    if target["user_id"] == current["user_id"]:
        raise HTTPException(400, "Cannot send request to yourself")
    blocked = await db.contacts.find_one({
        "$or": [
            {"user_id": current["user_id"], "contact_id": target["user_id"], "blocked": True},
            {"user_id": target["user_id"], "contact_id": current["user_id"], "blocked": True},
        ]
    })
    if blocked:
        raise HTTPException(403, "Cannot send request - blocked")

    if await are_contacts(current["user_id"], target["user_id"]):
        return {"ok": True, "message": "Already contacts"}

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

    now = iso(now_utc())
    for a, b in ((req["from_user_id"], req["to_user_id"]), (req["to_user_id"], req["from_user_id"])):
        await db.contacts.update_one(
            {"user_id": a, "contact_id": b},
            {"$setOnInsert": {
                "user_id": a,
                "contact_id": b,
                "created_at": now,
                "blocked": False,
                "muted": False,
            }},
            upsert=True,
        )

    asyncio.create_task(send_push_for_friend_accept(req["from_user_id"], current))
    return {"ok": True}


@router.post("/requests/reject")
async def reject_friend_request(body: FriendRequestActionIn, current=Depends(get_current_user)):
    await db.friend_requests.update_one(
        {"request_id": body.request_id, "to_user_id": current["user_id"], "status": "pending"},
        {"$set": {"status": "rejected", "expires_at": friend_request_resolved_expires_at()}},
    )
    logger.info(f"friend request rejected: {body.request_id} by {current['user_id']}")
    return {"ok": True}


@router.get("")
async def list_contacts(current=Depends(get_current_user)):
    contact_docs = await db.contacts.find({"user_id": current["user_id"]}, {"_id": 0}).to_list(500)
    contact_ids = [c["contact_id"] for c in contact_docs]
    if not contact_ids:
        return []
    users = await db.users.find(
        {"user_id": {"$in": contact_ids}},
        {"_id": 0, "user_id": 1, "username": 1, "avatar": 1, "public_key": 1, "last_seen": 1},
    ).to_list(500)
    user_map = {u["user_id"]: u for u in users}
    result = []
    for doc in contact_docs:
        u = user_map.get(doc["contact_id"])
        if u:
            result.append({
                **u,
                "blocked": doc.get("blocked", False),
                "muted": doc.get("muted", False),
            })
    return result


@router.delete("/{contact_user_id}")
async def remove_contact(contact_user_id: str, current=Depends(get_current_user)):
    await db.contacts.delete_many({"$or": [
        {"user_id": current["user_id"], "contact_id": contact_user_id},
        {"user_id": contact_user_id, "contact_id": current["user_id"]},
    ]})
    return {"ok": True}


@router.post("/{contact_user_id}/block")
async def block_contact(contact_user_id: str, current=Depends(get_current_user)):
    await db.contacts.update_one(
        {"user_id": current["user_id"], "contact_id": contact_user_id},
        {"$set": {"blocked": True}},
    )
    logger.info(f"user blocked contact: {current['user_id']} blocked {contact_user_id}")
    return {"ok": True}


@router.post("/{contact_user_id}/unblock")
async def unblock_contact(contact_user_id: str, current=Depends(get_current_user)):
    await db.contacts.update_one(
        {"user_id": current["user_id"], "contact_id": contact_user_id},
        {"$set": {"blocked": False}},
    )
    return {"ok": True}


@router.post("/{contact_user_id}/mute")
async def mute_contact(contact_user_id: str, current=Depends(get_current_user)):
    await db.contacts.update_one(
        {"user_id": current["user_id"], "contact_id": contact_user_id},
        {"$set": {"muted": True}},
    )
    return {"ok": True}


@router.post("/{contact_user_id}/unmute")
async def unmute_contact(contact_user_id: str, current=Depends(get_current_user)):
    await db.contacts.update_one(
        {"user_id": current["user_id"], "contact_id": contact_user_id},
        {"$set": {"muted": False}},
    )
    return {"ok": True}