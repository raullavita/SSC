import pytest
from fastapi import HTTPException

from core.group_profile import (
    GROUP_DESCRIPTION_MAX,
    normalize_group_description,
)
from core.group_roles import ROLE_ADMIN, ROLE_MEMBER, ROLE_OWNER, can_edit_group_profile


def test_normalize_group_description_trims_and_collapses():
    assert normalize_group_description("  hello   world  ") == "hello world"
    assert normalize_group_description("   ") is None


def test_normalize_group_description_rejects_too_long():
    with pytest.raises(HTTPException):
        normalize_group_description("x" * (GROUP_DESCRIPTION_MAX + 1))


def test_can_edit_group_profile_privileged_only():
    conv = {
        "is_group": True,
        "participants": ["u_owner", "u_admin", "u_mem"],
        "member_roles": {
            "u_owner": ROLE_OWNER,
            "u_admin": ROLE_ADMIN,
            "u_mem": ROLE_MEMBER,
        },
    }
    assert can_edit_group_profile(conv, "u_owner") is True
    assert can_edit_group_profile(conv, "u_admin") is True
    assert can_edit_group_profile(conv, "u_mem") is False