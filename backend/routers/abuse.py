"""Abuse reporting API — Engine 8."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.abuse_policy import spam_score_heuristic
from db import get_database
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/abuse", tags=["abuse"])


class ReportBody(BaseModel):
    target_user_id: str = Field(min_length=3)
    conversation_id: str | None = None
    reason: str = Field(min_length=3, max_length=256)
    sample_text: str = Field(default="", max_length=500)


@router.post("/report")
async def report_abuse(
    body: ReportBody,
    user_id: str = Depends(get_current_user_id),
    _client: str = Depends(get_client_header),
) -> dict:
    if body.target_user_id == user_id:
        raise HTTPException(status_code=400, detail="cannot_report_self")

    db = get_database()
    doc = {
        "_id": f"report-{user_id}-{body.target_user_id}-{int(datetime.now(timezone.utc).timestamp())}",
        "reporter_id": user_id,
        "target_user_id": body.target_user_id,
        "conversation_id": body.conversation_id,
        "reason": body.reason.strip(),
        "spam_score": spam_score_heuristic(body.sample_text),
        "created_at": datetime.now(timezone.utc),
    }
    await db.beta_feedback.insert_one(doc)
    return {"ok": True, "spam_score": doc["spam_score"]}