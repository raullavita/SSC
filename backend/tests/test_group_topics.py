import pytest
from fastapi import HTTPException

from core.group_topics import (
    GENERAL_TOPIC_ID,
    bump_topic_activity,
    create_group_topic,
    delete_group_topic,
    ensure_group_topics,
    message_topic_query_filter,
    normalize_topic_name,
    rename_group_topic,
    resolve_message_topic_id,
    topics_for_api,
)


def _group(**overrides):
    base = {
        "conversation_id": "g_test",
        "is_group": True,
        "participants": ["u_a", "u_b"],
        "created_at": "2026-06-20T08:00:00+00:00",
        "owner_id": "u_a",
    }
    base.update(overrides)
    return base


def test_ensure_group_topics_adds_general():
    conv = _group()
    out = ensure_group_topics(conv)
    assert out["group_topics"][0]["topic_id"] == GENERAL_TOPIC_ID
    assert out["group_topics"][0]["is_default"] is True


def test_normalize_topic_name_rejects_empty():
    with pytest.raises(HTTPException):
        normalize_topic_name("   ")


def test_create_group_topic_appends():
    conv = ensure_group_topics(_group())
    topics, topic = create_group_topic(conv, name="Announcements", created_by="u_a")
    assert topic["name"] == "Announcements"
    assert topic["topic_id"].startswith("t_")
    assert len(topics) == 2


def test_rename_group_topic_updates_name():
    conv = ensure_group_topics(_group())
    topics, topic = create_group_topic(conv, name="Roadmap", created_by="u_a")
    conv = {**conv, "group_topics": topics}
    renamed = rename_group_topic(conv, topic["topic_id"], "Launch")
    assert renamed[1]["name"] == "Launch"


def test_delete_group_topic_removes_custom():
    conv = ensure_group_topics(_group())
    topics, topic = create_group_topic(conv, name="Temp", created_by="u_a")
    conv = {**conv, "group_topics": topics}
    remaining = delete_group_topic(conv, topic["topic_id"])
    assert len(remaining) == 1
    assert remaining[0]["topic_id"] == GENERAL_TOPIC_ID


def test_resolve_message_topic_id_defaults_general():
    conv = ensure_group_topics(_group())
    assert resolve_message_topic_id(conv, None) == GENERAL_TOPIC_ID


def test_message_topic_query_filter_general_includes_legacy():
    filt = message_topic_query_filter(GENERAL_TOPIC_ID)
    assert "$or" in filt


def test_topics_for_api_sorts_general_first():
    conv = ensure_group_topics(_group())
    topics, _ = create_group_topic(conv, name="Beta", created_by="u_a")
    conv = {**conv, "group_topics": topics}
    api_topics = topics_for_api(conv)
    assert api_topics[0]["topic_id"] == GENERAL_TOPIC_ID


def test_bump_topic_activity():
    conv = ensure_group_topics(_group())
    bumped = bump_topic_activity(conv["group_topics"], GENERAL_TOPIC_ID, "2026-06-29T12:00:00+00:00")
    assert bumped[0]["last_activity_at"] == "2026-06-29T12:00:00+00:00"