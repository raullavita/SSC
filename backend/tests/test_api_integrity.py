"""Engine 2 Step 2.4 — API response integrity."""
from datetime import datetime, timezone
from pathlib import Path

from core.api_integrity import (
    FORBIDDEN_RESPONSE_FIELDS,
    MESSAGE_STORAGE_OMIT,
    project_message_for_viewer,
    project_status_for_viewer,
    sanitize_message_for_storage,
    sanitize_status_for_storage,
)


def test_forbidden_fields_include_length_and_username():
    assert "plaintext_length" in FORBIDDEN_RESPONSE_FIELDS
    assert "sender_username" in FORBIDDEN_RESPONSE_FIELDS


def test_project_message_strips_forbidden_and_peer_keys():
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
    for field in FORBIDDEN_RESPONSE_FIELDS:
        assert field not in out


def test_project_message_serializes_datetimes():
    ts = datetime(2026, 6, 23, 12, 0, 0, tzinfo=timezone.utc)
    msg = {
        "message_id": "m_2",
        "encrypted_keys": {"u_a": "k"},
        "created_at": ts,
        "expires_at": ts,
    }
    out = project_message_for_viewer(msg, "u_a")
    assert out["created_at"].endswith("+00:00")
    assert out["expires_at"].endswith("+00:00")


def test_project_status_strips_length_and_hides_viewers_from_peers():
    status = {
        "status_id": "s_1",
        "author_id": "u_a",
        "encrypted_keys": {"u_a": "ka", "u_b": "kb"},
        "plaintext_length": 8,
        "viewers": ["u_b"],
    }
    author_view = project_status_for_viewer(status, "u_a")
    assert "plaintext_length" not in author_view
    assert author_view["viewers"] == ["u_b"]

    peer_view = project_status_for_viewer(status, "u_b")
    assert "plaintext_length" not in peer_view
    assert "viewers" not in peer_view
    assert peer_view["encrypted_keys"] == {"u_b": "kb"}


def test_sanitize_message_for_storage_omits_leaks():
    raw = {
        "message_id": "m_3",
        "ciphertext": "ct",
        "sender_username": "bob",
        "plaintext_length": 99,
        "encrypted_keys": {"u_a": "k"},
    }
    stored = sanitize_message_for_storage(raw)
    for field in MESSAGE_STORAGE_OMIT:
        assert field not in stored
    assert stored["ciphertext"] == "ct"


def test_sanitize_status_for_storage_drops_plaintext_length():
    stored = sanitize_status_for_storage({
        "status_id": "s_2",
        "ciphertext": "ct",
        "plaintext_length": 5,
    })
    assert "plaintext_length" not in stored
    assert stored["ciphertext"] == "ct"


def test_messages_router_uses_sanitize_and_projection():
    text = (Path(__file__).resolve().parents[1] / "routers" / "messages.py").read_text(encoding="utf-8")
    assert "sanitize_message_for_storage" in text
    assert "project_message_for_viewer" in text
    assert "broadcast_message_to_conversation" in text
    assert "plaintext_length" not in text


def test_statuses_router_uses_projection_and_sanitize():
    text = (Path(__file__).resolve().parents[1] / "routers" / "statuses.py").read_text(encoding="utf-8")
    assert "sanitize_status_for_storage" in text
    assert "project_status_for_viewer" in text
    assert "plaintext_length" not in text


def test_realtime_broadcast_projects_per_recipient():
    text = (Path(__file__).resolve().parents[1] / "core" / "realtime.py").read_text(encoding="utf-8")
    assert "broadcast_message_to_conversation" in text
    assert "project_message_for_viewer" in text
    assert 'send_to_user(uid, {' in text or "send_to_user(uid," in text


def test_frontend_does_not_send_plaintext_length():
    root = Path(__file__).resolve().parents[2]
    chat = (root / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    stories = (root / "frontend" / "src" / "components" / "Stories.jsx").read_text(encoding="utf-8")
    crypto = (root / "frontend" / "src" / "lib" / "crypto.js").read_text(encoding="utf-8")
    assert "plaintext_length" not in chat
    assert "plaintext_length" not in stories
    assert "plaintext_length" not in crypto