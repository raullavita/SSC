import pytest
from fastapi import HTTPException

from core.message_mentions import (
    MAX_MENTIONED_USERS,
    normalize_mentioned_user_ids,
    validate_mentioned_users_for_group,
)


def test_normalize_mentioned_user_ids_dedupes():
    assert normalize_mentioned_user_ids(["u_a", "u_a", "u_b"]) == ["u_a", "u_b"]


def test_normalize_mentioned_user_ids_rejects_too_many():
    ids = [f"u_{i}" for i in range(MAX_MENTIONED_USERS + 1)]
    with pytest.raises(HTTPException) as exc:
        normalize_mentioned_user_ids(ids)
    assert exc.value.status_code == 400


def test_validate_mentions_ignored_for_dm():
    out = validate_mentioned_users_for_group(
        is_group=False,
        participant_ids=["u_me", "u_peer"],
        mentioned_user_ids=["u_peer"],
        sender_id="u_me",
    )
    assert out == []


def test_validate_mentions_requires_participant():
    with pytest.raises(HTTPException) as exc:
        validate_mentioned_users_for_group(
            is_group=True,
            participant_ids=["u_me", "u_a"],
            mentioned_user_ids=["u_other"],
            sender_id="u_me",
        )
    assert exc.value.status_code == 400


def test_validate_mentions_rejects_self():
    with pytest.raises(HTTPException) as exc:
        validate_mentioned_users_for_group(
            is_group=True,
            participant_ids=["u_me", "u_a"],
            mentioned_user_ids=["u_me"],
            sender_id="u_me",
        )
    assert exc.value.status_code == 400


def test_validate_mentions_ok():
    out = validate_mentioned_users_for_group(
        is_group=True,
        participant_ids=["u_me", "u_a", "u_b"],
        mentioned_user_ids=["u_a", "u_b"],
        sender_id="u_me",
    )
    assert out == ["u_a", "u_b"]