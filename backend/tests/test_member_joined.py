from core.member_joined import (
    build_member_joined_at_for_participants,
    ensure_member_joined_at,
    enrich_members_with_joined_at,
    joined_at_after_member_added,
    joined_at_after_member_removed,
    member_joined_at_for_api,
)


def test_build_member_joined_at_for_participants():
    out = build_member_joined_at_for_participants(
        ["u_a", "u_b"],
        joined_at="2026-06-29T10:00:00+00:00",
    )
    assert out == {
        "u_a": "2026-06-29T10:00:00+00:00",
        "u_b": "2026-06-29T10:00:00+00:00",
    }


def test_ensure_member_joined_at_backfills_from_created_at():
    conv = {
        "participants": ["u_a", "u_b"],
        "created_at": "2026-06-20T08:00:00+00:00",
    }
    out = ensure_member_joined_at(conv)
    assert out["member_joined_at"]["u_a"] == "2026-06-20T08:00:00+00:00"
    assert out["member_joined_at"]["u_b"] == "2026-06-20T08:00:00+00:00"


def test_joined_at_after_member_added_sets_new_timestamp():
    conv = {
        "participants": ["u_a"],
        "created_at": "2026-06-20T08:00:00+00:00",
        "member_joined_at": {"u_a": "2026-06-20T08:00:00+00:00"},
    }
    joined = joined_at_after_member_added(conv, ["u_b"])
    assert joined["u_a"] == "2026-06-20T08:00:00+00:00"
    assert joined["u_b"] != joined["u_a"]


def test_joined_at_after_member_removed_drops_user():
    conv = {
        "participants": ["u_a", "u_b"],
        "member_joined_at": {
            "u_a": "2026-06-20T08:00:00+00:00",
            "u_b": "2026-06-21T08:00:00+00:00",
        },
    }
    joined = joined_at_after_member_removed(conv, "u_b")
    assert joined == {"u_a": "2026-06-20T08:00:00+00:00"}


def test_enrich_members_with_joined_at():
    members = enrich_members_with_joined_at(
        [{"user_id": "u_a", "username": "alice"}],
        {"u_a": "2026-06-20T08:00:00+00:00"},
    )
    assert members[0]["joined_at"] == "2026-06-20T08:00:00+00:00"


def test_member_joined_at_for_api_returns_copy():
    conv = {
        "participants": ["u_a"],
        "created_at": "2026-06-20T08:00:00+00:00",
    }
    out = member_joined_at_for_api(conv)
    out["u_a"] = "mutated"
    assert member_joined_at_for_api(conv)["u_a"] == "2026-06-20T08:00:00+00:00"