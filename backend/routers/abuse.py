"""Abuse reporting API — Engine 8 + Tier D6 pipeline."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.abuse_enforcement import (
    abuse_report_limiter,
    is_user_blocked,
    process_abuse_report,
    record_user_block,
)
from core.abuse_policy import spam_score_heuristic
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/abuse", tags=["abuse"])


class ReportBody(BaseModel):
    target_user_id: str = Field(min_length=3)
    conversation_id: str | None = None
    reason: str = Field(min_length=3, max_length=256)
    sample_text: str = Field(default="", max_length=500)
    also_block: bool = False


class BlockBody(BaseModel):
    target_user_id: str = Field(min_length=3)


@router.post("/report")
async def report_abuse(
    body: ReportBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if body.target_user_id == user_id:
        raise HTTPException(status_code=400, detail="cannot_report_self")

    if not await abuse_report_limiter.allow(f"abuse_report:{user_id}"):
        raise HTTPException(status_code=429, detail="abuse_report_rate_limited")

    db = get_database()
    result = await process_abuse_report(
        db,
        reporter_id=user_id,
        target_user_id=body.target_user_id,
        conversation_id=body.conversation_id,
        reason=body.reason.strip(),
        spam_score=spam_score_heuristic(body.sample_text),
        also_block=body.also_block,
    )
    return {"ok": True, **result}


@router.post("/block")
async def block_user(
    body: BlockBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if body.target_user_id == user_id:
        raise HTTPException(status_code=400, detail="cannot_block_self")
    db = get_database()
    await record_user_block(db, user_id, body.target_user_id)
    return {"ok": True, "blocked_user_id": body.target_user_id}


@router.get("/blocks")
async def list_blocks(
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    cursor = db.user_blocks.find({"blocker_id": user_id})
    items = [
        {
            "blocked_user_id": doc.get("blocked_id"),
            "created_at": doc.get("created_at"),
        }
        async for doc in cursor
    ]
    return {"blocks": items}


@router.get("/blocked-by/{target_user_id}")
async def check_blocked(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    db = get_database()
    blocked = await is_user_blocked(db, target_user_id, user_id)
    return {"blocked": blocked}