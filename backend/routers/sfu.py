"""SFU room API — mediasoup OSS — Engine 9/11."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.retention_policy import default_expires_at
from core.sfu_client import delete_sfu_room, provision_sfu_room
from core.ws_hub import ws_hub
from core.sfu_policy import (
    MAX_SFU_PARTICIPANTS,
    SFU_ENABLED,
    SFU_WS_URL,
    new_sfu_room_id,
    sfu_room_token,
)
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/sfu", tags=["sfu"])


class CreateRoomBody(BaseModel):
    conversation_id: str = Field(min_length=3)
    expected_participants: int = Field(ge=2, le=MAX_SFU_PARTICIPANTS)


@router.get("/config")
async def sfu_config(
    _client: str = Depends(get_client_header),
    _user: str = Depends(get_current_user_id),
) -> dict:
    return {
        "enabled": SFU_ENABLED,
        "provider": "mediasoup",
        "ws_url": SFU_WS_URL if SFU_ENABLED else None,
        "max_participants": MAX_SFU_PARTICIPANTS,
        "repo": "https://github.com/versatica/mediasoup",
    }


@router.post("/rooms")
async def create_sfu_room(
    body: CreateRoomBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not SFU_ENABLED:
        raise HTTPException(status_code=503, detail="sfu_disabled")

    db = get_database()
    conv = await db.conversations.find_one(
        {"_id": body.conversation_id, "participants": user_id}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    participants = conv.get("participants", [])
    if len(participants) < body.expected_participants:
        raise HTTPException(status_code=400, detail="participant_count_mismatch")

    room_id = new_sfu_room_id()
    token = sfu_room_token(room_id, user_id)
    now = datetime.now(timezone.utc)
    ok, detail = await provision_sfu_room(room_id, token)
    if not ok:
        raise HTTPException(status_code=503, detail=f"sfu_provision_failed:{detail}")

    await db.call_sessions.insert_one(
        {
            "_id": room_id,
            "conversation_id": body.conversation_id,
            "host_id": user_id,
            "expected_participants": body.expected_participants,
            "call_type": "sfu",
            "status": "active",
            "sfu_provisioned": True,
            "created_at": now,
            "expires_at": default_expires_at(),
        }
    )

    return {
        "room_id": room_id,
        "join_token": token,
        "ws_url": SFU_WS_URL,
        "provider": "mediasoup",
        "provisioned": True,
    }


@router.post("/rooms/{room_id}/end")
async def end_sfu_room(
    room_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if not SFU_ENABLED:
        raise HTTPException(status_code=503, detail="sfu_disabled")

    db = get_database()
    session = await db.call_sessions.find_one({"_id": room_id, "call_type": "sfu"})
    if not session:
        raise HTTPException(status_code=404, detail="sfu_room_not_found")

    conv = await db.conversations.find_one(
        {"_id": session["conversation_id"], "participants": user_id}
    )
    if not conv:
        raise HTTPException(status_code=403, detail="not_a_conversation_participant")

    ok, detail = await delete_sfu_room(room_id)
    now = datetime.now(timezone.utc)
    await db.call_sessions.update_one(
        {"_id": room_id},
        {"$set": {"status": "ended", "ended_at": now, "ended_by": user_id}},
    )

    for pid in conv.get("participants", []):
        if pid != user_id:
            await ws_hub.publish(
                f"user:{pid}",
                {"type": "sfu_room_ended", "room_id": room_id, "from": user_id},
            )

    return {"ok": True, "sfu_deleted": ok, "detail": detail}