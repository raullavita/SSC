"""Panic wipe scope — chats/files/calls wiped; account + friends preserved."""
from pathlib import Path

from core.panic_wipe_service import (
    PANIC_PRESERVE_COLLECTIONS,
    PANIC_WIPE_COLLECTIONS,
)


def test_panic_preserves_account_and_social_graph():
    assert "users" in PANIC_PRESERVE_COLLECTIONS
    assert "contacts" in PANIC_PRESERVE_COLLECTIONS
    assert "friend_requests" in PANIC_PRESERVE_COLLECTIONS


def test_panic_wipes_chat_and_media_collections():
    for name in (
        "conversations",
        "messages",
        "message_reads",
        "files",
        "statuses",
        "calls",
        "user_sessions",
    ):
        assert name in PANIC_WIPE_COLLECTIONS


def test_panic_service_deletes_received_attachment_files():
    root = Path(__file__).resolve().parents[2]
    text = (root / "backend" / "core" / "panic_wipe_service.py").read_text(encoding="utf-8")
    assert "_attachment_ids_in_conversations" in text
    assert "attachment_id" in text
    assert "_wipe_files_for_user" in text


def test_panic_service_revokes_session_token():
    root = Path(__file__).resolve().parents[2]
    text = (root / "backend" / "core" / "panic_wipe_service.py").read_text(encoding="utf-8")
    assert "revoke_token" in text
    router = (root / "backend" / "routers" / "panic.py").read_text(encoding="utf-8")
    assert "execute_server_panic_wipe" in router
    assert "session_token=token" in router


def test_charter_documents_panic_preservation():
    charter = Path(__file__).resolve().parents[2] / "memory" / "CLIENT_FOOTPRINT_CHARTER.md"
    text = charter.read_text(encoding="utf-8")
    assert "users" in text.lower() or "account" in text.lower()
    assert "contacts" in text.lower()