"""Metadata policy tests — Engine 4."""

from __future__ import annotations

from core.metadata_policy import (
    FORBIDDEN_RESPONSE_FIELDS,
    public_conversation,
    public_message,
    scrub_payload,
)


def test_scrub_removes_forbidden_fields():
    raw = {"id": "c1", "peer_email": "secret@test.com", "peer_id": "u_1"}
    out = scrub_payload(raw)
    assert "peer_email" not in out
    assert out["peer_id"] == "u_1"


def test_public_conversation_omits_participants_list():
    doc = {
        "_id": "c_1",
        "type": "direct",
        "participants": ["u_a", "u_b"],
        "updated_at": None,
    }
    out = public_conversation(doc, "u_a")
    assert "participants" not in out
    assert out["peer_id"] == "u_b"
    assert set(out.keys()).issubset(
        {
            "id",
            "type",
            "peer_id",
            "updated_at",
            "pinned",
            "muted",
            "unread_count",
            "privacy",
        }
    )


def test_scrub_recursive_nested_forbidden():
    raw = {
        "message": {"participants": ["u_a", "u_b"], "id": "m1"},
        "last_active": "2026-01-01T00:00:00Z",
    }
    out = scrub_payload(raw)
    assert "last_active" not in out
    assert "participants" not in out["message"]


def test_auth_user_payload_shape():
    from routers.auth import _user_payload  # noqa: PLC0415

    out = _user_payload(
        {
            "_id": "u_test",
            "email": "secret@test.com",
            "display_name": "Test User",
        }
    )
    assert out == {"id": "u_test", "display_name": "Test User"}
    assert "email" not in out


def test_public_message_has_no_preview_fields():
    doc = {
        "_id": "m_1",
        "conversation_id": "c_1",
        "sender_id": "u_a",
        "ciphertext": "aGVsbG8=",
        "protocol": "placeholder",
        "created_at": None,
        "message_preview": "leak",
    }
    out = public_message(doc)
    assert "message_preview" not in out
    assert not FORBIDDEN_RESPONSE_FIELDS.intersection(out.keys())