"""Real-time contact / friend-request events over WebSocket (TASK C)."""
from __future__ import annotations

from typing import Any, Dict, Optional

from core.realtime import manager


async def _send(user_id: str, payload: Dict[str, Any]) -> None:
    if not user_id:
        return
    await manager.send_to_user(user_id, payload)


async def notify_friend_request(
    to_user_id: str,
    *,
    request_id: str,
    from_user_id: str,
    from_username: str,
) -> None:
    await _send(to_user_id, {
        "type": "friend-request",
        "request_id": request_id,
        "from_user_id": from_user_id,
        "from_username": from_username,
    })


async def notify_friend_request_sent(
    from_user_id: str,
    *,
    request_id: str,
    to_user_id: str,
    to_username: str,
) -> None:
    """Sync outgoing pending list on sender's other devices."""
    await _send(from_user_id, {
        "type": "friend-request-sent",
        "request_id": request_id,
        "to_user_id": to_user_id,
        "to_username": to_username,
    })


async def notify_friend_accepted(
    requester_id: str,
    accepter_id: str,
    *,
    request_id: str,
    accepter_username: str,
) -> None:
    await _send(requester_id, {
        "type": "friend-accepted",
        "request_id": request_id,
        "contact_user_id": accepter_id,
        "contact_username": accepter_username,
    })
    await _send(accepter_id, {
        "type": "contacts-changed",
        "reason": "friend-accepted",
        "request_id": request_id,
    })


async def notify_friend_rejected(
    requester_id: str,
    rejector_id: str,
    *,
    request_id: str,
) -> None:
    await _send(requester_id, {
        "type": "friend-rejected",
        "request_id": request_id,
    })
    await _send(rejector_id, {
        "type": "contacts-changed",
        "reason": "friend-rejected",
        "request_id": request_id,
    })


async def notify_contacts_changed(user_id: str, *, reason: str, request_id: Optional[str] = None) -> None:
    payload: Dict[str, Any] = {"type": "contacts-changed", "reason": reason}
    if request_id:
        payload["request_id"] = request_id
    await _send(user_id, payload)