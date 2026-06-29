"""Group roles and permissions — Q.25 (owner / admin / member)."""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException

ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
ROLE_MEMBER = "member"
ALLOWED_ROLES = frozenset({ROLE_OWNER, ROLE_ADMIN, ROLE_MEMBER})

POSTING_ALL = "all"
POSTING_ADMINS_ONLY = "admins_only"
ADD_MEMBERS_ADMINS = "admins"
ADD_MEMBERS_OWNER_ONLY = "owner_only"

ALLOWED_POSTING_POLICIES = frozenset({POSTING_ALL, POSTING_ADMINS_ONLY})
ALLOWED_ADD_MEMBER_POLICIES = frozenset({ADD_MEMBERS_ADMINS, ADD_MEMBERS_OWNER_ONLY})

DEFAULT_GROUP_PERMISSIONS: Dict[str, str] = {
    "posting": POSTING_ALL,
    "add_members": ADD_MEMBERS_ADMINS,
}


def default_group_permissions() -> Dict[str, str]:
    return dict(DEFAULT_GROUP_PERMISSIONS)


def resolve_owner_id(conv: dict) -> Optional[str]:
    return conv.get("owner_id") or conv.get("admin_id") or conv.get("created_by")


def normalize_member_role(value: Optional[str]) -> str:
    role = str(value or "").strip().lower()
    if role not in ALLOWED_ROLES:
        raise HTTPException(400, "Invalid member role")
    return role


def normalize_posting_policy(value: Optional[str]) -> str:
    policy = str(value or "").strip().lower()
    if policy not in ALLOWED_POSTING_POLICIES:
        raise HTTPException(400, "Invalid posting policy")
    return policy


def normalize_add_members_policy(value: Optional[str]) -> str:
    policy = str(value or "").strip().lower()
    if policy not in ALLOWED_ADD_MEMBER_POLICIES:
        raise HTTPException(400, "Invalid add-members policy")
    return policy


def build_member_roles_for_participants(
    participant_ids: list[str],
    *,
    owner_id: str,
    extra_roles: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    roles: Dict[str, str] = {}
    for pid in participant_ids:
        if extra_roles and pid in extra_roles:
            roles[pid] = normalize_member_role(extra_roles[pid])
        elif pid == owner_id:
            roles[pid] = ROLE_OWNER
        else:
            roles[pid] = ROLE_MEMBER
    if owner_id not in roles:
        roles[owner_id] = ROLE_OWNER
    return roles


def ensure_member_roles(conv: dict) -> dict:
    if conv.get("member_roles"):
        return conv
    owner_id = resolve_owner_id(conv)
    participants = list(conv.get("participants") or [])
    if not owner_id and participants:
        owner_id = sorted(participants)[0]
    roles = build_member_roles_for_participants(participants, owner_id=owner_id or "")
    return {**conv, "member_roles": roles}


def group_permissions_for(conv: dict) -> Dict[str, str]:
    raw = conv.get("group_permissions") or {}
    return {
        "posting": raw.get("posting", POSTING_ALL),
        "add_members": raw.get("add_members", ADD_MEMBERS_ADMINS),
    }


def get_member_role(conv: dict, user_id: str) -> str:
    enriched = ensure_member_roles(conv)
    return enriched.get("member_roles", {}).get(user_id, ROLE_MEMBER)


def is_privileged_role(role: str) -> bool:
    return role in (ROLE_OWNER, ROLE_ADMIN)


def can_post_in_group(conv: dict, user_id: str) -> bool:
    if not conv.get("is_group"):
        return True
    if user_id not in (conv.get("participants") or []):
        return False
    perms = group_permissions_for(conv)
    if perms["posting"] == POSTING_ALL:
        return True
    return is_privileged_role(get_member_role(conv, user_id))


def can_add_members(conv: dict, user_id: str) -> bool:
    if not conv.get("is_group"):
        return False
    perms = group_permissions_for(conv)
    role = get_member_role(conv, user_id)
    if perms["add_members"] == ADD_MEMBERS_OWNER_ONLY:
        return role == ROLE_OWNER
    return role in (ROLE_OWNER, ROLE_ADMIN)


def can_remove_member(conv: dict, actor_id: str, target_id: str) -> bool:
    if target_id not in (conv.get("participants") or []):
        return False
    if actor_id == target_id:
        return True
    target_role = get_member_role(conv, target_id)
    if target_role == ROLE_OWNER:
        return False
    actor_role = get_member_role(conv, actor_id)
    if actor_role == ROLE_OWNER:
        return True
    if actor_role == ROLE_ADMIN and target_role == ROLE_MEMBER:
        return True
    return False


def can_manage_roles(conv: dict, actor_id: str) -> bool:
    return get_member_role(conv, actor_id) == ROLE_OWNER


def can_update_permissions(conv: dict, actor_id: str) -> bool:
    return get_member_role(conv, actor_id) == ROLE_OWNER


def apply_member_role(
    conv: dict,
    *,
    target_user_id: str,
    new_role: str,
) -> Tuple[dict, Dict[str, str]]:
    if target_user_id not in (conv.get("participants") or []):
        raise HTTPException(404, "Member not in this group")
    normalized = normalize_member_role(new_role)
    roles = dict(ensure_member_roles(conv).get("member_roles") or {})
    current = roles.get(target_user_id, ROLE_MEMBER)
    if current == ROLE_OWNER and normalized != ROLE_OWNER:
        raise HTTPException(400, "Transfer ownership before changing the owner role")
    if normalized == ROLE_OWNER:
        owner_id = resolve_owner_id(conv) or target_user_id
        for uid, role in list(roles.items()):
            if role == ROLE_OWNER and uid != target_user_id:
                roles[uid] = ROLE_ADMIN
        roles[target_user_id] = ROLE_OWNER
        owner_id = target_user_id
    else:
        roles[target_user_id] = normalized
        owner_id = resolve_owner_id(conv)
    updated = {
        **conv,
        "member_roles": roles,
        "owner_id": owner_id,
        "admin_id": owner_id,
    }
    return updated, roles


def apply_group_permissions(conv: dict, *, posting: Optional[str], add_members: Optional[str]) -> dict:
    perms = group_permissions_for(conv)
    if posting is not None:
        perms["posting"] = normalize_posting_policy(posting)
    if add_members is not None:
        perms["add_members"] = normalize_add_members_policy(add_members)
    return {**conv, "group_permissions": perms}


def roles_after_member_added(conv: dict, new_member_ids: list[str]) -> Dict[str, str]:
    roles = dict(ensure_member_roles(conv).get("member_roles") or {})
    for uid in new_member_ids:
        if uid not in roles:
            roles[uid] = ROLE_MEMBER
    return roles


def roles_after_member_removed(conv: dict, removed_user_id: str) -> Tuple[Dict[str, str], Optional[str]]:
    roles = dict(ensure_member_roles(conv).get("member_roles") or {})
    roles.pop(removed_user_id, None)
    owner_id = resolve_owner_id(conv)
    if removed_user_id != owner_id:
        return roles, owner_id

    candidates = [
        uid for uid, role in roles.items()
        if role in (ROLE_ADMIN, ROLE_MEMBER)
    ]
    if not candidates:
        return roles, None
    new_owner = sorted(candidates)[0]
    for uid in list(roles.keys()):
        if roles[uid] == ROLE_OWNER:
            roles[uid] = ROLE_ADMIN
    roles[new_owner] = ROLE_OWNER
    return roles, new_owner


def roles_for_api(conv: dict) -> Dict[str, Any]:
    enriched = ensure_member_roles(conv)
    owner_id = resolve_owner_id(enriched)
    return {
        "owner_id": owner_id,
        "admin_id": owner_id,
        "member_roles": deepcopy(enriched.get("member_roles") or {}),
        "group_permissions": group_permissions_for(enriched),
    }