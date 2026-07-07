"""Public website feedback & reviews — metadata-minimized, spam-filtered."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from core.abuse_policy import spam_score_heuristic

FEEDBACK_CATEGORIES = frozenset({"review", "bug", "idea", "problem"})
FEEDBACK_PLATFORMS = frozenset({"windows", "android", "website", "other"})
MAX_DISPLAY_NAME = 40
MIN_MESSAGE_LEN = 10
MAX_MESSAGE_LEN = 2000
PUBLIC_SPAM_THRESHOLD = 3
REJECT_SPAM_THRESHOLD = 8
PUBLIC_LIST_LIMIT = 30


def normalize_category(value: str) -> str:
    cat = (value or "review").strip().lower()
    return cat if cat in FEEDBACK_CATEGORIES else "review"


def normalize_platform(value: str | None) -> str | None:
    if not value:
        return None
    plat = value.strip().lower()
    return plat if plat in FEEDBACK_PLATFORMS else "other"


def validate_feedback_message(message: str) -> str | None:
    text = (message or "").strip()
    if len(text) < MIN_MESSAGE_LEN:
        return "message_too_short"
    if len(text) > MAX_MESSAGE_LEN:
        return "message_too_long"
    return None


def build_feedback_doc(
    *,
    display_name: str | None,
    rating: int | None,
    category: str,
    platform: str | None,
    message: str,
) -> dict:
    now = datetime.now(timezone.utc)
    spam = spam_score_heuristic(message)
    published = spam <= PUBLIC_SPAM_THRESHOLD
    return {
        "_id": f"fb_{uuid4().hex}",
        "display_name": (display_name or "SSC user")[:MAX_DISPLAY_NAME],
        "rating": rating,
        "category": category,
        "platform": platform,
        "message": message.strip(),
        "spam_score": spam,
        "published": published,
        "created_at": now,
    }


def public_feedback_row(doc: dict) -> dict:
    out = {
        "id": doc["_id"],
        "display_name": doc.get("display_name") or "SSC user",
        "category": doc.get("category") or "review",
        "message": doc.get("message") or "",
        "created_at": doc.get("created_at"),
    }
    if doc.get("rating") is not None:
        out["rating"] = doc["rating"]
    if doc.get("platform"):
        out["platform"] = doc["platform"]
    return out