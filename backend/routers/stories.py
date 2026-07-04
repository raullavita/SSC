"""Encrypted stories/status routes — Step 7."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.ids import new_story_id
from core.retention_policy import default_expires_at
from core.signal_policy import SIGNAL_PROTOCOL_V1, validate_signal_ciphertext
from core.story_policy import SIGNAL_PROTOCOL_STORY, STORY_MAX_PER_USER, public_story
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/stories", tags=["stories"])


class CreateStoryBody(BaseModel):
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_STORY)


async def _peer_ids_for_user(db, user_id: str) -> set[str]:
    peers: set[str] = set()
    cursor = db.conversations.find({"participants": user_id})
    async for conv in cursor:
        for pid in conv.get("participants", []):
            if pid != user_id:
                peers.add(pid)
    return peers


@router.get("/feed")
async def stories_feed(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    peers = await _peer_ids_for_user(db, user_id)
    visible_users = peers | {user_id}
    now = datetime.now(timezone.utc)
    cursor = db.stories.find(
        {
            "user_id": {"$in": list(visible_users)},
            "expires_at": {"$gt": now},
        }
    ).sort("created_at", -1)
    items = [public_story(doc) async for doc in cursor]
    return {"stories": items}


@router.post("")
async def create_story(
    body: CreateStoryBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    protocol = body.protocol or SIGNAL_PROTOCOL_STORY
    ok, detail = validate_signal_ciphertext(body.ciphertext, protocol)
    if not ok and protocol == SIGNAL_PROTOCOL_STORY:
        ok, detail = validate_signal_ciphertext(body.ciphertext, SIGNAL_PROTOCOL_V1)
        if ok:
            protocol = SIGNAL_PROTOCOL_V1
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    db = get_database()
    now = datetime.now(timezone.utc)
    active = await db.stories.count_documents(
        {"user_id": user_id, "expires_at": {"$gt": now}}
    )
    if active >= STORY_MAX_PER_USER:
        raise HTTPException(status_code=400, detail="story_limit_reached")

    doc = {
        "_id": new_story_id(),
        "user_id": user_id,
        "ciphertext": body.ciphertext,
        "protocol": protocol,
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.stories.insert_one(doc)
    return {"story": public_story(doc)}


@router.delete("/{story_id}")
async def delete_story(
    story_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    result = await db.stories.delete_one({"_id": story_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="story_not_found")
    return {"ok": True, "story_id": story_id}