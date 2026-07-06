"""Encrypted poll routes — Step 7."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from core.abuse_policy import msg_rate_limiter
from core.ids import new_message_id, new_poll_id
from core.message_fanout import fanout_message
from core.metadata_policy import public_message
from core.poll_policy import (
    SIGNAL_PROTOCOL_POLL,
    public_poll,
    validate_option_count,
    validate_option_index,
)
from core.read_receipts import increment_unread
from core.retention_policy import default_expires_at
from core.sealed_sender_policy import mark_sealed
from core.signal_policy import validate_signal_ciphertext
from db import get_database
from deps import get_client_header, get_current_user_id
from push import notify_conversation_participants

router = APIRouter(tags=["polls"])


class CreatePollBody(BaseModel):
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_POLL)
    option_count: int = Field(ge=2, le=8)


class CastVoteBody(BaseModel):
    option_index: int = Field(ge=0)
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_POLL)


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


async def _poll_tallies(db, poll_id: str, option_count: int) -> dict[str, int]:
    tallies = {str(i): 0 for i in range(option_count)}
    cursor = db.message_poll_votes.find({"poll_id": poll_id})
    async for vote in cursor:
        idx = vote.get("option_index")
        if idx is not None and 0 <= int(idx) < option_count:
            tallies[str(int(idx))] += 1
    return tallies


@router.post("/conversations/{conversation_id}/polls")
async def create_poll(
    conversation_id: str,
    body: CreatePollBody,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not await msg_rate_limiter.allow(f"poll:{user_id}"):
        raise HTTPException(status_code=429, detail="poll_rate_limited")

    ok, detail = validate_option_count(body.option_count)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    protocol = body.protocol or SIGNAL_PROTOCOL_POLL
    ok, detail = validate_signal_ciphertext(body.ciphertext, protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    db = get_database()
    conv = await _require_participant(db, conversation_id, user_id)
    now = datetime.now(timezone.utc)
    expires_at = default_expires_at()
    message_id = new_message_id()
    poll_id = new_poll_id()

    msg_doc = mark_sealed(
        {
            "_id": message_id,
            "conversation_id": conversation_id,
            "sender_id": user_id,
            "ciphertext": body.ciphertext,
            "protocol": protocol,
            "message_kind": "poll",
            "poll_id": poll_id,
            "created_at": now,
            "expires_at": expires_at,
        },
        sealed=False,
    )
    poll_doc = {
        "_id": poll_id,
        "conversation_id": conversation_id,
        "message_id": message_id,
        "creator_id": user_id,
        "ciphertext": body.ciphertext,
        "protocol": protocol,
        "option_count": body.option_count,
        "created_at": now,
        "expires_at": expires_at,
    }

    await db.messages.insert_one(msg_doc)
    await db.polls.insert_one(poll_doc)
    await db.conversations.update_one(
        {"_id": conversation_id},
        {"$set": {"updated_at": now}},
    )

    participants = conv.get("participants", [])
    await fanout_message(conversation_id, msg_doc, participants, user_id)
    await increment_unread(db, conversation_id, participants, user_id)
    background_tasks.add_task(
        notify_conversation_participants,
        participants,
        sender_id=user_id,
        conversation_id=conversation_id,
        message_id=message_id,
        kind="poll",
    )

    return {
        "poll": public_poll(poll_doc),
        "message": public_message(msg_doc, viewer_id=user_id),
    }


@router.get("/conversations/{conversation_id}/polls/{poll_id}")
async def get_poll(
    conversation_id: str,
    poll_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    poll = await db.polls.find_one({"_id": poll_id, "conversation_id": conversation_id})
    if not poll:
        raise HTTPException(status_code=404, detail="poll_not_found")

    viewer_vote = await db.message_poll_votes.find_one(
        {"poll_id": poll_id, "user_id": user_id}
    )
    tallies = await _poll_tallies(db, poll_id, int(poll.get("option_count", 0)))
    out = {
        "poll": public_poll(poll),
        "tallies": tallies,
    }
    if viewer_vote is not None:
        out["viewer_vote"] = int(viewer_vote.get("option_index", 0))
    return out


@router.post("/conversations/{conversation_id}/polls/{poll_id}/votes")
async def cast_vote(
    conversation_id: str,
    poll_id: str,
    body: CastVoteBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    await _require_participant(db, conversation_id, user_id)
    poll = await db.polls.find_one({"_id": poll_id, "conversation_id": conversation_id})
    if not poll:
        raise HTTPException(status_code=404, detail="poll_not_found")

    option_count = int(poll.get("option_count", 0))
    ok, detail = validate_option_index(body.option_index, option_count)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    protocol = body.protocol or SIGNAL_PROTOCOL_POLL
    ok, detail = validate_signal_ciphertext(body.ciphertext, protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    now = datetime.now(timezone.utc)
    vote_id = f"{poll_id}:{user_id}"
    vote_doc = {
        "_id": vote_id,
        "poll_id": poll_id,
        "conversation_id": conversation_id,
        "user_id": user_id,
        "option_index": body.option_index,
        "ciphertext": body.ciphertext,
        "protocol": protocol,
        "created_at": now,
        "expires_at": poll.get("expires_at") or default_expires_at(),
    }
    await db.message_poll_votes.replace_one({"_id": vote_id}, vote_doc, upsert=True)

    tallies = await _poll_tallies(db, poll_id, option_count)
    return {
        "ok": True,
        "viewer_vote": body.option_index,
        "tallies": tallies,
    }