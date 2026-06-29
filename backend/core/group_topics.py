"""Group topics / threads — Q.28 (Telegram-style sub-channels)."""
from __future__ import annotations

import re
import uuid
from copy import deepcopy
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException

from core.group_roles import can_edit_group_profile
from core.utils import iso, now_utc

GENERAL_TOPIC_ID = "general"
MAX_GROUP_TOPICS = 20
MAX_TOPIC_NAME_LEN = 64


def normalize_topic_name(value: Optional[str]) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text:
        raise HTTPException(400, "Topic name is required")
    if len(text) > MAX_TOPIC_NAME_LEN:
        raise HTTPException(400, f"Topic name must be at most {MAX_TOPIC_NAME_LEN} characters")
    return text


def default_general_topic(conv: dict) -> Dict[str, object]:
    fallback = conv.get("created_at") or iso(now_utc())
    return {
        "topic_id": GENERAL_TOPIC_ID,
        "name": "General",
        "is_default": True,
        "created_at": fallback,
        "created_by": None,
        "last_activity_at": conv.get("last_activity_at") or fallback,
    }


def ensure_group_topics(conv: dict) -> dict:
    if not conv.get("is_group"):
        return conv
    topics = list(conv.get("group_topics") or [])
    if any(t.get("topic_id") == GENERAL_TOPIC_ID for t in topics):
        return conv
    return {**conv, "group_topics": [default_general_topic(conv), *topics]}


def topics_for_api(conv: dict) -> List[dict]:
    enriched = ensure_group_topics(conv)
    topics = list(enriched.get("group_topics") or [])

    def sort_key(topic: dict) -> tuple:
        if topic.get("is_default") or topic.get("topic_id") == GENERAL_TOPIC_ID:
            return (0, "", "")
        return (
            1,
            topic.get("last_activity_at") or "",
            topic.get("name") or "",
        )

    topics.sort(key=sort_key, reverse=False)
    # Non-default topics: sort by last_activity desc within bucket 1
    default = [t for t in topics if t.get("topic_id") == GENERAL_TOPIC_ID]
    other = sorted(
        [t for t in topics if t.get("topic_id") != GENERAL_TOPIC_ID],
        key=lambda t: (t.get("last_activity_at") or "", t.get("name") or ""),
        reverse=True,
    )
    return deepcopy([*default, *other])


def can_manage_group_topics(conv: dict, user_id: str) -> bool:
    return can_edit_group_profile(conv, user_id)


def validate_topic_for_group(conv: dict, topic_id: Optional[str]) -> str:
    if not conv.get("is_group"):
        raise HTTPException(400, "Topics are only for group conversations")
    tid = str(topic_id or GENERAL_TOPIC_ID).strip() or GENERAL_TOPIC_ID
    enriched = ensure_group_topics(conv)
    known = {t.get("topic_id") for t in enriched.get("group_topics") or []}
    if tid not in known:
        raise HTTPException(400, "Unknown group topic")
    return tid


def resolve_message_topic_id(conv: dict, topic_id: Optional[str]) -> Optional[str]:
    if not conv.get("is_group"):
        return None
    return validate_topic_for_group(conv, topic_id or GENERAL_TOPIC_ID)


def message_topic_query_filter(topic_id: str) -> dict:
    if topic_id == GENERAL_TOPIC_ID:
        return {
            "$or": [
                {"topic_id": {"$exists": False}},
                {"topic_id": None},
                {"topic_id": GENERAL_TOPIC_ID},
            ]
        }
    return {"topic_id": topic_id}


def create_group_topic(conv: dict, *, name: str, created_by: str) -> Tuple[List[dict], dict]:
    enriched = ensure_group_topics(conv)
    topics = list(enriched.get("group_topics") or [])
    if len(topics) >= MAX_GROUP_TOPICS:
        raise HTTPException(400, f"Groups can have at most {MAX_GROUP_TOPICS} topics")
    normalized = normalize_topic_name(name)
    if any((t.get("name") or "").lower() == normalized.lower() for t in topics):
        raise HTTPException(400, "A topic with this name already exists")
    created = iso(now_utc())
    topic = {
        "topic_id": f"t_{uuid.uuid4().hex[:12]}",
        "name": normalized,
        "is_default": False,
        "created_at": created,
        "created_by": created_by,
        "last_activity_at": created,
    }
    topics.append(topic)
    return topics, topic


def rename_group_topic(conv: dict, topic_id: str, name: str) -> List[dict]:
    tid = validate_topic_for_group(conv, topic_id)
    if tid == GENERAL_TOPIC_ID:
        raise HTTPException(400, "Cannot rename the default topic")
    normalized = normalize_topic_name(name)
    topics = list(ensure_group_topics(conv).get("group_topics") or [])
    if any(
        (t.get("name") or "").lower() == normalized.lower() and t.get("topic_id") != tid
        for t in topics
    ):
        raise HTTPException(400, "A topic with this name already exists")
    updated: List[dict] = []
    for topic in topics:
        if topic.get("topic_id") == tid:
            updated.append({**topic, "name": normalized})
        else:
            updated.append(topic)
    return updated


def delete_group_topic(conv: dict, topic_id: str) -> List[dict]:
    tid = validate_topic_for_group(conv, topic_id)
    if tid == GENERAL_TOPIC_ID:
        raise HTTPException(400, "Cannot delete the default topic")
    topics = [
        t for t in ensure_group_topics(conv).get("group_topics") or []
        if t.get("topic_id") != tid
    ]
    return topics


def bump_topic_activity(topics: List[dict], topic_id: str, at_iso: str) -> List[dict]:
    updated: List[dict] = []
    for topic in topics:
        if topic.get("topic_id") == topic_id:
            updated.append({**topic, "last_activity_at": at_iso})
        else:
            updated.append(topic)
    return updated