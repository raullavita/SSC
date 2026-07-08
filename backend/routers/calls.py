"""WebRTC call signaling relay — Engine 8."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.call_policy import (
    CALL_END_REASONS,
    CALL_TYPES,
    MESH_MAX_PARTICIPANTS,
    public_call_session,
    validate_signaling_envelope,
)
from push import send_missed_call_push_to_user
from core.turn_policy import build_ice_servers
from core.sfu_client import delete_sfu_room
from core.sfu_policy import SFU_ROOM_PREFIX, should_use_sfu
from core.ids import new_call_id
from core.retention_policy import default_expires_at
from core.signal_policy import SIGNAL_PROTOCOL_V1
from core.ws_hub import ws_hub
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/calls", tags=["calls"])


class StartCallBody(BaseModel):
    conversation_id: str = Field(min_length=3)
    callee_id: str | None = Field(default=None, min_length=3)
    video: bool = False
    group_call: bool = False


class SignalBody(BaseModel):
    call_id: str = Field(min_length=3)
    signal_type: str = Field(min_length=3)
    ciphertext: str = Field(min_length=1)
    protocol: str = Field(default=SIGNAL_PROTOCOL_V1)
    target_peer_id: str | None = Field(default=None, min_length=3)


class EndCallBody(BaseModel):
    reason: str = Field(default="ended", min_length=3, max_length=16)


@router.get("/ice-servers")
async def get_ice_servers(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    """Time-limited TURN credentials + STUN for WebRTC (1:1 mesh and SFU client transports)."""
    return build_ice_servers(user_id)


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
    use_sfu = should_use_sfu(len(participants)) or (
        body.group_call and len(participants) > MESH_MAX_PARTICIPANTS
    )
    if not use_sfu and len(participants) > MESH_MAX_PARTICIPANTS:
        raise HTTPException(status_code=400, detail="mesh_participant_cap_exceeded_use_sfu")

    callee_id = body.callee_id
    if conv.get("type") == "group" or body.group_call:
        callee_id = callee_id or next((p for p in participants if p != user_id), None)
    if not callee_id or callee_id not in participants:
        raise HTTPException(status_code=400, detail="callee_not_in_conversation")

    now = datetime.now(timezone.utc)
    call_id = new_call_id()
    is_group_call = conv.get("type") == "group" or body.group_call
    doc = {
        "_id": call_id,
        "conversation_id": body.conversation_id,
        "caller_id": user_id,
        "callee_id": callee_id,
        "call_type": "video" if body.video else "audio",
        "video": body.video,
        "status": "ringing",
        "mode": "sfu" if use_sfu else "mesh",
        "group_call": is_group_call,
        "participant_ids": list(participants),
        "participant_count": len(participants),
        "created_at": now,
        "expires_at": default_expires_at(),
    }
    await db.call_sessions.insert_one(doc)

    payload = {"type": "incoming_call", "call": public_call_session(doc)}
    if use_sfu:
        payload["sfu_required"] = True
    if is_group_call or use_sfu:
        for pid in participants:
            if pid != user_id:
                await ws_hub.publish(f"user:{pid}", payload)
    else:
        await ws_hub.publish(f"user:{callee_id}", payload)

    return {"call": public_call_session(doc), "mode": doc["mode"], "sfu_required": use_sfu}


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

    if call.get("group_call"):
        allowed = set(call.get("participant_ids") or [])
        if user_id not in allowed:
            raise HTTPException(status_code=403, detail="not_a_call_participant")
        target = body.target_peer_id
        if not target or target not in allowed or target == user_id:
            raise HTTPException(status_code=400, detail="target_peer_required_for_group_call")
        await ws_hub.publish(
            f"user:{target}",
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


@router.post("/{call_id}/end")
async def end_call(
    call_id: str,
    body: EndCallBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if body.reason not in CALL_END_REASONS:
        raise HTTPException(status_code=400, detail="invalid_end_reason")

    db = get_database()
    call = await db.call_sessions.find_one({"_id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="call_not_found")

    if call.get("group_call"):
        allowed = set(call.get("participant_ids") or [])
        if user_id not in allowed:
            raise HTTPException(status_code=403, detail="not_a_call_participant")
        peers = [pid for pid in allowed if pid != user_id]
    else:
        participants = {call.get("caller_id"), call.get("callee_id")}
        if user_id not in participants:
            raise HTTPException(status_code=403, detail="not_a_call_participant")
        peer = call["callee_id"] if user_id == call["caller_id"] else call["caller_id"]
        peers = [peer]

    now = datetime.now(timezone.utc)
    await db.call_sessions.update_one(
        {"_id": call_id},
        {"$set": {"status": body.reason, "ended_at": now, "ended_by": user_id}},
    )

    for peer in peers:
        await ws_hub.publish(
            f"user:{peer}",
            {
                "type": "call_ended",
                "call_id": call_id,
                "reason": body.reason,
                "from": user_id,
            },
        )

    conversation_id = call.get("conversation_id")
    if body.reason == "declined" and call.get("caller_id"):
        await send_missed_call_push_to_user(
            call["caller_id"],
            conversation_id=conversation_id,
            call_id=call_id,
        )
    elif body.reason == "missed" and call.get("callee_id"):
        await send_missed_call_push_to_user(
            call["callee_id"],
            conversation_id=conversation_id,
            call_id=call_id,
        )

    sfu_room_id = call_id if call_id.startswith(f"{SFU_ROOM_PREFIX}-") else None
    if sfu_room_id or call.get("call_type") == "sfu" or call.get("sfu_provisioned"):
        room_to_delete = sfu_room_id or call_id
        await delete_sfu_room(room_to_delete)

    return {"ok": True, "reason": body.reason}