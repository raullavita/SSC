"""WebRTC call signaling relay — Engine 8."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.call_policy import (
    CALL_TYPES,
    MESH_MAX_PARTICIPANTS,
    public_call_session,
    validate_signaling_envelope,
)
from core.ids import new_call_id
from core.retention_policy import default_expires_at
from core.signal_policy import SIGNAL_PROTOCOL_V1
from core.ws_hub import ws_hub
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/calls", tags=["calls"])


class StartCallBody(BaseModel):
    conversation_id: str = Field(min_length=3)
    callee_id: str = Field(min_length=3)
    video: bool = False


class SignalBody(BaseModel):
    call_id: str = Field(min_length=3)
    signal_type: str = Field(min_length=3)
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_V1)


async def _require_participant(db, conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": conversation_id, "participants": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return doc


@router.post("")
async def start_call(
    body: StartCallBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    conv = await _require_participant(db, body.conversation_id, user_id)
    participants = conv.get("participants", [])
    if len(participants) > MESH_MAX_PARTICIPANTS:
        raise HTTPException(status_code=400, detail="mesh_participant_cap_exceeded")
    if body.callee_id not in participants:
        raise HTTPException(status_code=400, detail="callee_not_in_conversation")

    now = datetime.now(timezone.utc)
    call_id = new_call_id()
    doc = {
        "_id": call_id,
        "conversation_id": body.conversation_id,
        "caller_id": user_id,
        "callee_id": body.callee_id,
        "call_type": "video" if body.video else "audio",
        "video": body.video,
        "status": "ringing",
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.call_sessions.insert_one(doc)

    await ws_hub.publish(
        f"user:{body.callee_id}",
        {"type": "incoming_call", "call": public_call_session(doc)},
    )
    return {"call": public_call_session(doc)}


@router.post("/signal")
async def relay_signal(
    body: SignalBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if body.signal_type not in CALL_TYPES:
        raise HTTPException(status_code=400, detail="invalid_signal_type")

    ok, detail = validate_signaling_envelope(body.ciphertext, body.protocol)
    if not ok:
        raise HTTPException(status_code=400, detail=detail)

    db = get_database()
    call = await db.call_sessions.find_one({"_id": body.call_id})
    if not call:
        raise HTTPException(status_code=404, detail="call_not_found")

    participants = {call.get("caller_id"), call.get("callee_id")}
    if user_id not in participants:
        raise HTTPException(status_code=403, detail="not_a_call_participant")

    peer = call["callee_id"] if user_id == call["caller_id"] else call["caller_id"]
    await ws_hub.publish(
        f"user:{peer}",
        {
            "type": "call_signal",
            "call_id": body.call_id,
            "signal_type": body.signal_type,
            "ciphertext": body.ciphertext,
            "protocol": body.protocol,
            "from": user_id,
        },
    )
    return {"ok": True}