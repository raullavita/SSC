"""TASK C — contact / friend-request WebSocket realtime."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_contact_realtime_module_exports():
    from core.contact_realtime import (
        notify_contacts_changed,
        notify_friend_accepted,
        notify_friend_rejected,
        notify_friend_request,
        notify_friend_request_sent,
    )

    assert callable(notify_friend_request)
    assert callable(notify_friend_accepted)


def test_contacts_router_wires_realtime():
    text = (REPO / "backend" / "routers" / "contacts.py").read_text(encoding="utf-8")
    assert "notify_friend_request" in text
    assert "notify_friend_accepted" in text
    assert "notify_friend_rejected" in text
    assert "await notify_friend_request" in text


def test_friend_request_push_not_skipped_when_ws_connected():
    text = (REPO / "backend" / "push.py").read_text(encoding="utf-8")
    block = text.split("async def send_push_for_friend_request")[1].split("async def")[0]
    assert "user_sockets" not in block