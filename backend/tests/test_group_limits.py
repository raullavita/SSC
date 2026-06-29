import time

import pytest
from fastapi import HTTPException

from core.conversation_meta import sanitize_conversation_for_api
from core.group_limits import (
    MAX_GROUP_PARTICIPANTS,
    assert_can_add_to_group,
    assert_group_size_allowed,
    group_limits_public_config,
    is_group_full,
    remaining_group_slots,
)
from core.group_roles import build_member_roles_for_participants
from core.member_joined import build_member_joined_at_for_participants
from core.group_topics import ensure_group_topics


def test_group_limits_public_config():
    assert group_limits_public_config() == {"max_participants": 50}


def test_remaining_group_slots():
    assert remaining_group_slots(48) == 2
    assert remaining_group_slots(50) == 0
    assert is_group_full(50) is True


def test_assert_group_size_allowed_rejects_over_cap():
    with pytest.raises(HTTPException) as exc:
        assert_group_size_allowed(51)
    assert "50" in exc.value.detail


def test_assert_can_add_to_group_rejects_overflow():
    with pytest.raises(HTTPException) as exc:
        assert_can_add_to_group(49, 2)
    assert "full" in exc.value.detail.lower()


def test_sanitize_50_member_group_metadata_perf():
    participants = [f"u_{i:02d}" for i in range(MAX_GROUP_PARTICIPANTS)]
    owner_id = participants[0]
    created = "2026-06-29T10:00:00+00:00"
    conv = ensure_group_topics({
        "conversation_id": "g_perf50",
        "is_group": True,
        "participants": participants,
        "owner_id": owner_id,
        "admin_id": owner_id,
        "member_roles": build_member_roles_for_participants(participants, owner_id=owner_id),
        "member_joined_at": build_member_joined_at_for_participants(participants, joined_at=created),
        "created_at": created,
    })
    members = [{"user_id": pid, "username": f"user{pid}"} for pid in participants[1:]]

    start = time.perf_counter()
    for _ in range(25):
        out = sanitize_conversation_for_api({**conv, "members": members}, owner_id)
        assert len(out["participants"]) == MAX_GROUP_PARTICIPANTS
        assert len(out["group_topics"]) >= 1
    elapsed = time.perf_counter() - start
    assert elapsed < 0.5, f"50-member sanitize loop too slow: {elapsed:.3f}s"