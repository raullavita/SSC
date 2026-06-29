"""Engine 1 Step 1.4 — conversation metadata minimization."""
from core.conversation_meta import (
    GENERIC_GROUP_LABEL,
    group_display_label,
    last_activity_from_message,
    project_message_for_viewer,
    sanitize_conversation_for_api,
)


def test_last_activity_empty():
    assert last_activity_from_message(None) == {
        "has_messages": False,
        "last_message_at": None,
        "last_message_type": None,
    }


def test_last_activity_no_ciphertext():
    summary = last_activity_from_message({
        "ciphertext": "SECRET",
        "encrypted_keys": {"u_a": "x", "u_b": "y"},
        "sender_username": "alice",
        "created_at": "2026-06-23T12:00:00+00:00",
        "message_type": "image",
    })
    assert summary["has_messages"] is True
    assert summary["last_message_type"] == "image"
    assert "ciphertext" not in summary
    assert "encrypted_keys" not in summary


def test_project_message_for_viewer_strips_other_keys():
    msg = {
        "message_id": "m_1",
        "sender_id": "u_a",
        "sender_username": "alice",
        "ciphertext": "ct",
        "iv": "iv",
        "encrypted_keys": {"u_a": "ka", "u_b": "kb"},
        "plaintext_length": 12,
        "attachment_encrypted_keys": {"u_a": "aa", "u_b": "ab"},
    }
    out = project_message_for_viewer(msg, "u_b")
    assert out["encrypted_keys"] == {"u_b": "kb"}
    assert out["attachment_encrypted_keys"] == {"u_b": "ab"}
    assert "sender_username" not in out
    assert "plaintext_length" not in out


def test_sanitize_conversation_no_custom_name():
    conv = {
        "conversation_id": "g_abc",
        "participants": ["u_a", "u_b", "u_c"],
        "is_group": True,
        "name": "Secret project title",
        "admin_id": "u_a",
        "created_at": "2026-06-23T12:00:00+00:00",
        "last_activity": {"has_messages": True, "last_message_at": "2026-06-23T12:00:00+00:00", "last_message_type": "text"},
        "last_message": {"ciphertext": "leak"},
    }
    out = sanitize_conversation_for_api(conv, "u_a")
    assert "name" not in out
    assert "last_message" not in out
    assert out["display_label"] == group_display_label(3)
    assert GENERIC_GROUP_LABEL in out["display_label"]
    assert out["owner_id"] == "u_a"
    assert out["member_roles"]["u_a"] == "owner"
    assert out["group_permissions"]["posting"] == "all"
    assert "group_photo" not in out
    assert "group_description" not in out
    assert out["pinned"] is False


def test_sanitize_conversation_exposes_member_joined_at():
    conv = {
        "conversation_id": "g_abc",
        "participants": ["u_a", "u_b"],
        "is_group": True,
        "admin_id": "u_a",
        "created_at": "2026-06-20T08:00:00+00:00",
        "member_joined_at": {
            "u_a": "2026-06-20T08:00:00+00:00",
            "u_b": "2026-06-22T08:00:00+00:00",
        },
        "members": [{"user_id": "u_b", "username": "bob"}],
    }
    out = sanitize_conversation_for_api(conv, "u_a")
    assert out["member_joined_at"]["u_b"] == "2026-06-22T08:00:00+00:00"
    assert out["members"][0]["joined_at"] == "2026-06-22T08:00:00+00:00"


def test_sanitize_conversation_exposes_group_profile_fields():
    conv = {
        "conversation_id": "g_abc",
        "participants": ["u_a", "u_b"],
        "is_group": True,
        "admin_id": "u_a",
        "group_photo": "data:image/jpeg;base64,abc",
        "group_description": "Squad chat",
    }
    out = sanitize_conversation_for_api(conv, "u_a")
    assert out["group_photo"] == "data:image/jpeg;base64,abc"
    assert out["group_description"] == "Squad chat"


def test_sanitize_conversation_includes_pin_fields():
    conv = {
        "conversation_id": "c_abc",
        "participants": ["u_a", "u_b"],
        "is_group": False,
        "created_at": "2026-06-23T12:00:00+00:00",
        "peer": {"user_id": "u_b", "username": "bob"},
        "pinned": True,
        "pinned_at": "2026-06-29T08:00:00+00:00",
    }
    out = sanitize_conversation_for_api(conv, "u_a")
    assert out["pinned"] is True
    assert out["pinned_at"] == "2026-06-29T08:00:00+00:00"


def test_sanitize_conversation_includes_archive_fields():
    conv = {
        "conversation_id": "c_abc",
        "participants": ["u_a", "u_b"],
        "is_group": False,
        "created_at": "2026-06-23T12:00:00+00:00",
        "peer": {"user_id": "u_b", "username": "bob"},
        "archived": True,
        "archived_at": "2026-06-29T09:00:00+00:00",
    }
    out = sanitize_conversation_for_api(conv, "u_a")
    assert out["archived"] is True
    assert out["archived_at"] == "2026-06-29T09:00:00+00:00"


def test_group_display_label():
    assert group_display_label(3) == "Group (3)"