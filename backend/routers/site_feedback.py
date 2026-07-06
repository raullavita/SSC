"""Public website feedback — reviews, bugs, ideas (no auth required)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.site_feedback_policy import (
    PUBLIC_LIST_LIMIT,
    REJECT_SPAM_THRESHOLD,
    build_feedback_doc,
    normalize_category,
    normalize_platform,
    public_feedback_row,
    validate_feedback_message,
)
from db import get_database

router = APIRouter(prefix="/public", tags=["public"])


class SubmitFeedbackBody(BaseModel):
    display_name: str | None = Field(default=None, max_length=40)
    rating: int | None = Field(default=None, ge=1, le=5)
    category: str = Field(default="review", max_length=16)
    platform: str | None = Field(default=None, max_length=16)
    message: str = Field(min_length=10, max_length=2000)


@router.get("/feedback")
async def list_public_feedback() -> dict:
    db = get_database()
    cursor = (
        db.site_feedback.find({"published": True})
        .sort("created_at", -1)
        .limit(PUBLIC_LIST_LIMIT)
    )
    items = [public_feedback_row(doc) async for doc in cursor]
    return {"feedback": items}


@router.post("/feedback")
async def submit_feedback(body: SubmitFeedbackBody, request: Request) -> dict:
    err = validate_feedback_message(body.message)
    if err:
        raise HTTPException(status_code=400, detail=err)

    category = normalize_category(body.category)
    platform = normalize_platform(body.platform)
    doc = build_feedback_doc(
        display_name=body.display_name,
        rating=body.rating,
        category=category,
        platform=platform,
        message=body.message,
    )
    if doc["spam_score"] >= REJECT_SPAM_THRESHOLD:
        raise HTTPException(status_code=400, detail="feedback_rejected")

    db = get_database()
    await db.site_feedback.insert_one(doc)
    if not doc["published"]:
        return {"ok": True, "published": False, "detail": "feedback_received_pending_review"}
    return {"ok": True, "published": True, "feedback": public_feedback_row(doc)}