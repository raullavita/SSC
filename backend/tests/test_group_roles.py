import pytest
from fastapi import HTTPException

from core.group_roles import (
    ADD_MEMBERS_OWNER_ONLY,
    POSTING_ADMINS_ONLY,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    apply_member_role,
    can_add_members,
    can_post_in_group,
    can_remove_member,
    ensure_member_roles,
    roles_after_member_removed,
)


def _group(owner="u_owner", members=None):
    participants = sorted({owner, *(members or [])})
    return {
        "conversation_id": "g_test",
        "is_group": True,
        "participants": participants,
        "owner_id": owner,
        "admin_id": owner,
        "member_roles": {
            owner: ROLE_OWNER,
            **{m: ROLE_MEMBER for m in participants if m != owner},
        },
        "group_permissions": {"posting": "all", "add_members": "admins"},
    }


def test_ensure_member_roles_migrates_legacy_admin():
    conv = {
        "is_group": True,
        "participants": ["u_a", "u_b"],
        "admin_id": "u_a",
    }
    out = ensure_member_roles(conv)
    assert out["member_roles"]["u_a"] == ROLE_OWNER
    assert out["member_roles"]["u_b"] == ROLE_MEMBER


def test_posting_policy_blocks_members():
    conv = _group(members=["u_mem"])
    conv["group_permissions"]["posting"] = POSTING_ADMINS_ONLY
    assert can_post_in_group(conv, "u_owner") is True
    assert can_post_in_group(conv, "u_mem") is False


def test_add_members_owner_only():
    conv = _group(members=["u_admin", "u_mem"])
    conv["member_roles"]["u_admin"] = ROLE_ADMIN
    conv["group_permissions"]["add_members"] = ADD_MEMBERS_OWNER_ONLY
    assert can_add_members(conv, "u_owner") is True
    assert can_add_members(conv, "u_admin") is False


def test_remove_member_permissions():
    conv = _group(members=["u_admin", "u_mem"])
    conv["member_roles"]["u_admin"] = ROLE_ADMIN
    assert can_remove_member(conv, "u_owner", "u_mem") is True
    assert can_remove_member(conv, "u_admin", "u_mem") is True
    assert can_remove_member(conv, "u_admin", "u_owner") is False
    assert can_remove_member(conv, "u_mem", "u_admin") is False


def test_apply_member_role_promotes_admin():
    conv = _group(members=["u_mem"])
    updated, roles = apply_member_role(conv, target_user_id="u_mem", new_role=ROLE_ADMIN)
    assert roles["u_mem"] == ROLE_ADMIN
    assert updated["owner_id"] == "u_owner"


def test_owner_leave_transfers_ownership():
    conv = _group(members=["u_admin", "u_mem"])
    conv["member_roles"]["u_admin"] = ROLE_ADMIN
    roles, new_owner = roles_after_member_removed(conv, "u_owner")
    assert new_owner == "u_admin"
    assert roles["u_admin"] == ROLE_OWNER


def test_apply_member_role_rejects_owner_demote():
    conv = _group(members=["u_mem"])
    with pytest.raises(HTTPException):
        apply_member_role(conv, target_user_id="u_owner", new_role=ROLE_MEMBER)