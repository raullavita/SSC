"""Conversation CRUD routes."""
import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from core.auth import get_current_user
from core.contact_helpers import PEER_ROSTER_FIELDS, are_contacts
from core.database import db
from core.logging_config import logger
from core.group_members import add_group_members, remove_group_member
from core.member_joined import build_member_joined_at_for_participants
from core.group_limits import MAX_GROUP_PARTICIPANTS, assert_can_add_to_group, assert_group_size_allowed
from core.group_topics import (
    GENERAL_TOPIC_ID,
    bump_topic_activity,
    can_manage_group_topics,
    create_group_topic,
    delete_group_topic,
    ensure_group_topics,
    message_topic_query_filter,
    rename_group_topic,
    resolve_message_topic_id,
    validate_topic_for_group,
)
from core.group_profile import (
    encode_group_photo,
    normalize_group_description,
    validate_group_photo_bytes,
)
from core.group_roles import (
    apply_group_permissions,
    apply_member_role,
    build_member_roles_for_participants,
    can_add_members,
    can_edit_group_profile,
    can_manage_roles,
    can_remove_member,
    can_update_permissions,
    default_group_permissions,
)
from core.models import (
    AddGroupMembersIn,
    CreateConversationIn,
    GroupPermissionsIn,
    GroupProfileIn,
    GroupTopicIn,
    GroupTopicRenameIn,
    MemberRoleIn,
)
from core.push_helpers import send_push_for_group_added
from core.realtime import manager
from core.last_seen import project_user_for_peer
from core.conversation_meta import (
    last_activity_from_message,
    peer_summary,
    project_message_for_viewer,
    sanitize_conversation_for_api,
)
from core.conversation_archives import (
    attach_archive_fields,
    archive_conversation,
    clear_archives_for_conversation,
    unarchive_conversation,
)
from core.conversation_pins import (
    attach_pin_fields,
    clear_pins_for_conversation,
    pin_conversation,
    sort_conversations_for_sidebar,
    unpin_conversation,
)
from core.retention_db import bump_conversation_activity, conversation_activity_fields_for_participants
from core.utils import iso, now_utc
from security import rate_limit_check

router = APIRouter()


@router.post("")
async def create_conversation(body: CreateConversationIn, current=Depends(get_current_user)):
    if not rate_limit_check(
        f"newconv:{current['user_id']}",
        max_hits=12,
        window_sec=300,
        limiter="conversation_create",
    ):
        logger.warning(f"rate-limit new-convo user={current['user_id']}")
        raise HTTPException(429, "Too many new conversations recently")

    if not body.is_group and body.peer_username and not (body.peer_usernames and len(body.peer_usernames) > 1):
        target = await db.users.find_one({"username": body.peer_username}, {"_id": 0, "user_id": 1})
        if target and not await are_contacts(current["user_id"], target["user_id"]):
            raise HTTPException(403, "You must be mutual contacts to start a 1:1 conversation")

    if body.is_group or (body.peer_usernames and len(body.peer_usernames) > 1):
        if not rate_limit_check(
            f"groupconv:{current['user_id']}",
            max_hits=4,
            window_sec=600,
            limiter="group_create",
        ):
            logger.warning(f"rate-limit group-create user={current['user_id']}")
            raise HTTPException(429, "Too many new groups recently")
        usernames = body.peer_usernames or []
        if not usernames:
            raise HTTPException(400, "Group requires peer_usernames")
        usernames = [u for u in {u.strip() for u in usernames} if u and u != current["username"]]
        peers = await db.users.find(
            {"username": {"$in": usernames}},
            {"_id": 0, "password_hash": 0, "totp_secret": 0, "totp_pending_secret": 0},
        ).to_list(MAX_GROUP_PARTICIPANTS)
        found_unames = {p["username"] for p in peers}
        missing = [u for u in usernames if u not in found_unames]
        if missing:
            raise HTTPException(404, f"Unknown users: {', '.join(missing)}")
        for p in peers:
            if not await are_contacts(current["user_id"], p["user_id"]):
                raise HTTPException(403, f"Must be mutual contacts with {p['username']} to add to group")
        if len(peers) < 1:
            raise HTTPException(400, "Group needs at least 1 other participant")
        participants = sorted({current["user_id"], *[p["user_id"] for p in peers]})
        assert_group_size_allowed(len(participants))
        created = now_utc()
        activity = await conversation_activity_fields_for_participants(participants, created)
        owner_id = current["user_id"]
        member_roles = build_member_roles_for_participants(participants, owner_id=owner_id)
        created_iso = iso(created)
        member_joined_at = build_member_joined_at_for_participants(
            participants,
            joined_at=created_iso,
        )
        conv = ensure_group_topics({
            "conversation_id": f"g_{uuid.uuid4().hex[:14]}",
            "participants": participants,
            "is_group": True,
            "owner_id": owner_id,
            "admin_id": owner_id,
            "member_roles": member_roles,
            "member_joined_at": member_joined_at,
            "group_permissions": default_group_permissions(),
            "created_at": created_iso,
            "created_by": current["user_id"],
            **activity,
        })
        await db.conversations.insert_one(conv)
        conv.pop("_id", None)
        member_map = {current["user_id"]: peer_summary(current)}
        for peer_doc in peers:
            member_map[peer_doc["user_id"]] = peer_summary(peer_doc)
        for pid in participants:
            members = [member_map[uid] for uid in participants if uid != pid and uid in member_map]
            members = [m for m in members if m]
            payload = sanitize_conversation_for_api({**conv, "members": members}, pid)
            await manager.send_to_user(pid, {"type": "conversation-created", "data": payload})
            if pid != current["user_id"]:
                asyncio.create_task(send_push_for_group_added(pid, current, conv))
        return sanitize_conversation_for_api(conv, current["user_id"])

    if not body.peer_username:
        raise HTTPException(400, "peer_username is required")
    peer = await db.users.find_one(
        {"username": body.peer_username},
        {"_id": 0, "password_hash": 0, "totp_secret": 0, "totp_pending_secret": 0},
    )
    if not peer:
        raise HTTPException(404, "Peer not found")
    if peer["user_id"] == current["user_id"]:
        raise HTTPException(400, "Cannot create conversation with yourself")
    participants = sorted([current["user_id"], peer["user_id"]])
    existing = await db.conversations.find_one(
        {"participants": participants, "is_group": {"$ne": True}}, {"_id": 0}
    )
    if existing:
        await bump_conversation_activity(existing["conversation_id"])
        refreshed = await db.conversations.find_one(
            {"conversation_id": existing["conversation_id"]}, {"_id": 0},
        )
        base = refreshed or existing
        base["peer"] = peer_summary(peer)
        return sanitize_conversation_for_api(base, current["user_id"])
    created = now_utc()
    activity = await conversation_activity_fields_for_participants(participants, created)
    conv = {
        "conversation_id": f"c_{uuid.uuid4().hex[:14]}",
        "participants": participants,
        "is_group": False,
        "created_at": iso(created),
        "created_by": current["user_id"],
        **activity,
        "peer": peer_summary(peer),
    }
    await db.conversations.insert_one(conv)
    conv.pop("_id", None)
    return sanitize_conversation_for_api(conv, current["user_id"])


@router.get("")
async def list_conversations(current=Depends(get_current_user)):
    convs = await db.conversations.find(
        {"participants": current["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    peer_ids = set()
    for c in convs:
        for p in c["participants"]:
            if p != current["user_id"]:
                peer_ids.add(p)
    peers_list = await db.users.find(
        {"user_id": {"$in": list(peer_ids)}},
        PEER_ROSTER_FIELDS,
    ).to_list(500)
    peers_by_id = {p["user_id"]: p for p in peers_list}
    result = []
    me = current["user_id"]
    for c in convs:
        is_group = bool(c.get("is_group"))
        if is_group:
            members = [project_user_for_peer(peers_by_id.get(p)) for p in c["participants"] if p != me]
            c["members"] = [m for m in members if m]
            c["peer"] = None
        else:
            peer_id = next((p for p in c["participants"] if p != me), None)
            c["peer"] = project_user_for_peer(peers_by_id.get(peer_id)) if peer_id else None
        last_msg = await db.messages.find_one(
            {"conversation_id": c["conversation_id"]},
            {"_id": 0, "created_at": 1, "message_type": 1},
            sort=[("created_at", -1)],
        )
        c["last_activity"] = last_activity_from_message(last_msg)
        result.append(c)
    await attach_pin_fields(result, me)
    await attach_archive_fields(result, me)
    result = sort_conversations_for_sidebar(result)
    return [sanitize_conversation_for_api(c, me) for c in result]


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    topic_id: Optional[str] = Query(default=None),
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(404, "Conversation not found")
    query = {"conversation_id": conversation_id}
    if conv.get("is_group"):
        resolved_topic = resolve_message_topic_id(conv, topic_id)
        query.update(message_topic_query_filter(resolved_topic))
    msgs = await db.messages.find(
        query, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    projected = [project_message_for_viewer(m, current["user_id"]) for m in msgs]
    from core.message_polls import attach_poll_votes_to_messages
    from core.message_reactions import attach_reactions_to_messages

    with_reactions = await attach_reactions_to_messages(conversation_id, projected)
    return await attach_poll_votes_to_messages(conversation_id, with_reactions)


@router.get("/{conversation_id}/reads")
async def get_reads(conversation_id: str, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(404, "Conversation not found")
    from core.privacy_settings import filter_reads_for_viewer

    reads = await db.message_reads.find({"conversation_id": conversation_id}, {"_id": 0}).to_list(50)
    return await filter_reads_for_viewer(reads, current["user_id"], conv.get("participants") or [])


@router.post("/{conversation_id}/members")
async def add_conversation_members(
    conversation_id: str,
    body: AddGroupMembersIn,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_add_members(conv, current["user_id"]):
        raise HTTPException(403, "You do not have permission to add members")
    usernames = [u.strip() for u in body.peer_usernames if u and u.strip()]
    usernames = [u for u in usernames if u != current["username"]]
    if not usernames:
        raise HTTPException(400, "No usernames provided")
    peers = await db.users.find(
        {"username": {"$in": usernames}},
        {"_id": 0, "password_hash": 0, "totp_secret": 0, "totp_pending_secret": 0},
    ).to_list(MAX_GROUP_PARTICIPANTS)
    found = {p["username"] for p in peers}
    missing = [u for u in usernames if u not in found]
    if missing:
        raise HTTPException(404, f"Unknown users: {', '.join(missing)}")
    new_ids = [p["user_id"] for p in peers if p["user_id"] not in conv.get("participants", [])]
    assert_can_add_to_group(len(conv.get("participants", [])), len(new_ids))
    try:
        conv = await add_group_members(conv, actor_id=current["user_id"], peer_docs=peers)
    except ValueError as e:
        raise HTTPException(403, str(e)) from e
    except HTTPException:
        raise
    me = current["user_id"]
    member_map = {current["user_id"]: peer_summary(current)}
    for p in peers:
        member_map[p["user_id"]] = peer_summary(p)
    members = [member_map[uid] for uid in conv["participants"] if uid != me and uid in member_map]
    return sanitize_conversation_for_api({**conv, "members": members}, me)


@router.delete("/{conversation_id}/members/{user_id}")
async def remove_conversation_member(
    conversation_id: str,
    user_id: str,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    is_self = user_id == current["user_id"]
    if not can_remove_member(conv, current["user_id"], user_id):
        raise HTTPException(403, "You do not have permission to remove this member")
    if user_id not in conv.get("participants", []):
        raise HTTPException(404, "Member not in this group")
    updated = await remove_group_member(conv, target_user_id=user_id, actor_id=current["user_id"])
    if updated is None:
        return {"ok": True, "left": True, "conversation_id": conversation_id}
    me = current["user_id"]
    peers_list = await db.users.find(
        {"user_id": {"$in": updated["participants"]}},
        PEER_ROSTER_FIELDS,
    ).to_list(MAX_GROUP_PARTICIPANTS)
    peers_by_id = {p["user_id"]: p for p in peers_list}
    members = [project_user_for_peer(peers_by_id.get(p)) for p in updated["participants"] if p != me]
    return sanitize_conversation_for_api({**updated, "members": [m for m in members if m]}, me)


async def _group_conversation_payload(conv: dict, viewer_id: str) -> dict:
    peers_list = await db.users.find(
        {"user_id": {"$in": conv.get("participants", [])}},
        PEER_ROSTER_FIELDS,
    ).to_list(MAX_GROUP_PARTICIPANTS)
    peers_by_id = {p["user_id"]: p for p in peers_list}
    members = [
        project_user_for_peer(peers_by_id.get(p))
        for p in conv.get("participants", [])
        if p != viewer_id
    ]
    return sanitize_conversation_for_api(
        {**conv, "members": [m for m in members if m]},
        viewer_id,
    )


@router.patch("/{conversation_id}/group-profile")
async def update_group_profile(
    conversation_id: str,
    body: GroupProfileIn,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_edit_group_profile(conv, current["user_id"]):
        raise HTTPException(403, "Only group admins can edit the profile")
    description = normalize_group_description(body.description)
    if description is None:
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$unset": {"group_description": ""}, "$set": {"updated_at": iso(now_utc())}},
        )
        updated = {**conv}
        updated.pop("group_description", None)
    else:
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {"group_description": description, "updated_at": iso(now_utc())}},
        )
        updated = {**conv, "group_description": description}
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    return await _group_conversation_payload(updated, current["user_id"])


@router.post("/{conversation_id}/group-photo")
async def upload_group_photo(
    conversation_id: str,
    file: UploadFile = File(...),
    current=Depends(get_current_user),
):
    if not rate_limit_check(f"group-photo:{current['user_id']}", max_hits=10, window_sec=3600):
        raise HTTPException(429, "Too many group photo uploads")
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_edit_group_profile(conv, current["user_id"]):
        raise HTTPException(403, "Only group admins can edit the profile")
    data = await file.read()
    mime = validate_group_photo_bytes(data, (file.content_type or "").split(";")[0].strip().lower())
    photo = encode_group_photo(data, mime)
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"group_photo": photo, "updated_at": iso(now_utc())}},
    )
    updated = {**conv, "group_photo": photo}
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    return await _group_conversation_payload(updated, current["user_id"])


@router.delete("/{conversation_id}/group-photo")
async def remove_group_photo(
    conversation_id: str,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_edit_group_profile(conv, current["user_id"]):
        raise HTTPException(403, "Only group admins can edit the profile")
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$unset": {"group_photo": ""}, "$set": {"updated_at": iso(now_utc())}},
    )
    updated = {**conv}
    updated.pop("group_photo", None)
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    return await _group_conversation_payload(updated, current["user_id"])


@router.post("/{conversation_id}/topics")
async def create_conversation_topic(
    conversation_id: str,
    body: GroupTopicIn,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_manage_group_topics(conv, current["user_id"]):
        raise HTTPException(403, "Only group admins can manage topics")
    topics, _topic = create_group_topic(conv, name=body.name, created_by=current["user_id"])
    updated = {**ensure_group_topics(conv), "group_topics": topics}
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"group_topics": topics, "updated_at": iso(now_utc())}},
    )
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    return await _group_conversation_payload(updated, current["user_id"])


@router.patch("/{conversation_id}/topics/{topic_id}")
async def rename_conversation_topic(
    conversation_id: str,
    topic_id: str,
    body: GroupTopicRenameIn,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_manage_group_topics(conv, current["user_id"]):
        raise HTTPException(403, "Only group admins can manage topics")
    validate_topic_for_group(conv, topic_id)
    topics = rename_group_topic(conv, topic_id, body.name)
    updated = {**ensure_group_topics(conv), "group_topics": topics}
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"group_topics": topics, "updated_at": iso(now_utc())}},
    )
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    return await _group_conversation_payload(updated, current["user_id"])


@router.delete("/{conversation_id}/topics/{topic_id}")
async def delete_conversation_topic(
    conversation_id: str,
    topic_id: str,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_manage_group_topics(conv, current["user_id"]):
        raise HTTPException(403, "Only group admins can manage topics")
    validate_topic_for_group(conv, topic_id)
    if topic_id == GENERAL_TOPIC_ID:
        raise HTTPException(400, "Cannot delete the default topic")
    msg_count = await db.messages.count_documents({
        "conversation_id": conversation_id,
        **message_topic_query_filter(topic_id),
    })
    if msg_count > 0:
        raise HTTPException(400, "Delete messages in this topic before removing it")
    topics = delete_group_topic(conv, topic_id)
    updated = {**ensure_group_topics(conv), "group_topics": topics}
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"group_topics": topics, "updated_at": iso(now_utc())}},
    )
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    return await _group_conversation_payload(updated, current["user_id"])


@router.patch("/{conversation_id}/group-permissions")
async def update_group_permissions(
    conversation_id: str,
    body: GroupPermissionsIn,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_update_permissions(conv, current["user_id"]):
        raise HTTPException(403, "Only the group owner can change permissions")
    updated = apply_group_permissions(
        conv,
        posting=body.posting,
        add_members=body.add_members,
    )
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {
            "$set": {
                "group_permissions": updated["group_permissions"],
                "updated_at": iso(now_utc()),
            }
        },
    )
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    me = current["user_id"]
    peers_list = await db.users.find(
        {"user_id": {"$in": updated["participants"]}},
        PEER_ROSTER_FIELDS,
    ).to_list(MAX_GROUP_PARTICIPANTS)
    peers_by_id = {p["user_id"]: p for p in peers_list}
    members = [project_user_for_peer(peers_by_id.get(p)) for p in updated["participants"] if p != me]
    return sanitize_conversation_for_api({**updated, "members": [m for m in members if m]}, me)


@router.patch("/{conversation_id}/members/{user_id}/role")
async def update_member_role(
    conversation_id: str,
    user_id: str,
    body: MemberRoleIn,
    current=Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    if not conv.get("is_group"):
        raise HTTPException(400, "Not a group conversation")
    if not can_manage_roles(conv, current["user_id"]):
        raise HTTPException(403, "Only the group owner can change roles")
    updated, member_roles = apply_member_role(
        conv,
        target_user_id=user_id,
        new_role=body.role,
    )
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {
            "$set": {
                "member_roles": member_roles,
                "owner_id": updated.get("owner_id"),
                "admin_id": updated.get("admin_id"),
                "updated_at": iso(now_utc()),
            }
        },
    )
    from core.group_members import _broadcast_conv_update

    await _broadcast_conv_update(updated)
    me = current["user_id"]
    peers_list = await db.users.find(
        {"user_id": {"$in": updated["participants"]}},
        PEER_ROSTER_FIELDS,
    ).to_list(MAX_GROUP_PARTICIPANTS)
    peers_by_id = {p["user_id"]: p for p in peers_list}
    members = [project_user_for_peer(peers_by_id.get(p)) for p in updated["participants"] if p != me]
    return sanitize_conversation_for_api({**updated, "members": [m for m in members if m]}, me)


@router.post("/{conversation_id}/pin")
async def pin_chat(conversation_id: str, current=Depends(get_current_user)):
    conv = await pin_conversation(current["user_id"], conversation_id)
    return sanitize_conversation_for_api(conv, current["user_id"])


@router.delete("/{conversation_id}/pin")
async def unpin_chat(conversation_id: str, current=Depends(get_current_user)):
    conv = await unpin_conversation(current["user_id"], conversation_id)
    return sanitize_conversation_for_api(conv, current["user_id"])


@router.post("/{conversation_id}/archive")
async def archive_chat(conversation_id: str, current=Depends(get_current_user)):
    conv = await archive_conversation(current["user_id"], conversation_id)
    return sanitize_conversation_for_api(conv, current["user_id"])


@router.delete("/{conversation_id}/archive")
async def unarchive_chat(conversation_id: str, current=Depends(get_current_user)):
    conv = await unarchive_conversation(current["user_id"], conversation_id)
    return sanitize_conversation_for_api(conv, current["user_id"])


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(404, "Conversation not found")
    await db.messages.delete_many({"conversation_id": conversation_id})
    await db.message_reads.delete_many({"conversation_id": conversation_id})
    await clear_pins_for_conversation(conversation_id)
    await clear_archives_for_conversation(conversation_id)
    await db.conversations.delete_one({"conversation_id": conversation_id})
    return {"ok": True}