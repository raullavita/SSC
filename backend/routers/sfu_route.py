"""SFU join credentials for mediasoup group calls (Q.35)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth import get_current_user
from core.database import db
from core.sfu_auth import make_sfu_join_token
from core.sfu_policy import group_calls_public_config

router = APIRouter()


class SfuJoinRequest(BaseModel):
    conversation_id: str = Field(..., min_length=1)


@router.post("/calls/sfu-join")
async def sfu_join_credentials(body: SfuJoinRequest, current=Depends(get_current_user)):
    cfg = group_calls_public_config()
    if not cfg.get("sfu_enabled") or not cfg.get("sfu_url"):
        raise HTTPException(status_code=503, detail="SFU not enabled")

    conv = await db.conversations.find_one(
        {"conversation_id": body.conversation_id, "participants": current["user_id"]},
        {"_id": 0, "conversation_id": 1, "is_group": 1},
    )
    if not conv or not conv.get("is_group"):
        raise HTTPException(status_code=404, detail="group conversation not found")

    token = make_sfu_join_token(current["user_id"], body.conversation_id)
    return {
        "room_id": body.conversation_id,
        "sfu_url": cfg["sfu_url"],
        "token": token,
        "user_id": current["user_id"],
        "ttl_minutes": 10,
    }