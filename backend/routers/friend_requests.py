"""Friend requests — pending contact flow — Phase C1."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.friend_request_policy import FRIEND_REQUEST_STATUSES
from core.ids import new_conversation_id, new_friend_request_id
from core.retention_policy import default_expires_at
from core.ws_hub import ws_hub
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/friend_requests", tags=["friend_requests"])


class CreateFriendRequestBody(BaseModel):
    to_user_id: str = Field(min_length=3)
    note: str = Field(default="", max_length=200)


def _public_request(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "from_user_id": doc["from_user_id"],
        "to_user_id": doc["to_user_id"],
        "status": doc.get("status", "pending"),
        "note": doc.get("note", ""),
        "created_at": doc.get("created_at"),
        "expires_at": doc.get("expires_at"),
    }


@router.get("/incoming")
async def list_incoming(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)
    cursor = db.friend_requests.find(
        {
            "to_user_id": user_id,
            "status": "pending",
            "$or": [
                {"expires_at": {"$gt": now}},
                {"expires_at": None},
            ],
        }
    ).sort("created_at", -1)
    items = [_public_request(doc) async for doc in cursor]
    return {"requests": items}


@router.get("/outgoing")
async def list_outgoing(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)
    cursor = db.friend_requests.find(
        {
            "from_user_id": user_id,
            "status": "pending",
            "$or": [
                {"expires_at": {"$gt": now}},
                {"expires_at": None},
            ],
        }
    ).sort("created_at", -1)
    items = [_public_request(doc) async for doc in cursor]
    return {"requests": items}


@router.post("")
async def create_friend_request(
    body: CreateFriendRequestBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if body.to_user_id == user_id:
        raise HTTPException(status_code=400, detail="cannot_request_self")

    db = get_database()
    target = await db.users.find_one({"_id": body.to_user_id}, {"_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    existing_conv = await db.conversations.find_one(
        {
            "type": "direct",
            "participants": {"$all": [user_id, body.to_user_id]},
        }
    )
    if existing_conv:
        raise HTTPException(status_code=409, detail="already_contacts")

    pending = await db.friend_requests.find_one(
        {
            "from_user_id": user_id,
            "to_user_id": body.to_user_id,
            "status": "pending",
        }
    )
    if pending:
        return {"request": _public_request(pending), "existing": True}

    now = datetime.now(timezone.utc)
    doc = {
        "_id": new_friend_request_id(),
        "from_user_id": user_id,
        "to_user_id": body.to_user_id,
        "status": "pending",
        "note": body.note.strip(),
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.friend_requests.insert_one(doc)
    await ws_hub.publish(
        f"user:{body.to_user_id}",
        {"type": "friend_request", "request": _public_request(doc)},
    )
    return {"request": _public_request(doc), "existing": False}


@router.post("/{request_id}/accept")
async def accept_friend_request(
    request_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    req = await db.friend_requests.find_one({"_id": request_id})
    if not req or req.get("status") != "pending":
        raise HTTPException(status_code=404, detail="request_not_found")
    if req["to_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="not_request_recipient")

    now = datetime.now(timezone.utc)
    conv_id = new_conversation_id()
    await db.conversations.insert_one(
        {
            "_id": conv_id,
            "type": "direct",
            "participants": [req["from_user_id"], req["to_user_id"]],
            "created_at": now,
            "updated_at": now,
        }
    )
    await db.friend_requests.update_one(
        {"_id": request_id},
        {"$set": {"status": "accepted", "accepted_at": now, "conversation_id": conv_id}},
    )
    await ws_hub.publish(
        f"user:{req['from_user_id']}",
        {
            "type": "friend_request_accepted",
            "request_id": request_id,
            "conversation_id": conv_id,
        },
    )
    return {"ok": True, "conversation_id": conv_id}


@router.post("/{request_id}/decline")
async def decline_friend_request(
    request_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    req = await db.friend_requests.find_one({"_id": request_id})
    if not req or req.get("status") != "pending":
        raise HTTPException(status_code=404, detail="request_not_found")
    if req["to_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="not_request_recipient")

    now = datetime.now(timezone.utc)
    await db.friend_requests.update_one(
        {"_id": request_id},
        {"$set": {"status": "declined", "declined_at": now}},
    )
    await ws_hub.publish(
        f"user:{req['from_user_id']}",
        {"type": "friend_request_declined", "request_id": request_id},
    )
    return {"ok": True, "status": "declined"}