"""Push notification dispatch — generic payloads only — Engine 4."""

from __future__ import annotations

import logging
from typing import Any

from core.firebase_init import ensure_firebase
from core.push_payload import build_generic_push
from db import get_database

logger = logging.getLogger("ssc")


async def send_generic_push_to_user(
    user_id: str,
    *,
    conversation_id: str | None = None,
    message_id: str | None = None,
) -> dict[str, Any]:
    """Send generic push to all tokens registered for a user."""
    db = get_database()
    payload = build_generic_push(
        {
            k: v
            for k, v in {
                "conversation_id": conversation_id,
                "message_id": message_id,
            }.items()
            if v
        }
    )

    cursor = db.push_tokens.find({"user_id": user_id})
    sent = 0
    async for row in cursor:
        token = row.get("token")
        if not token:
            continue
        ok = await _dispatch_fcm(token, payload)
        if ok:
            sent += 1

    return {"user_id": user_id, "sent": sent, "payload": payload}


async def notify_conversation_participants(
    participant_ids: list[str],
    *,
    sender_id: str,
    conversation_id: str,
    message_id: str,
) -> list[dict[str, Any]]:
    results = []
    for uid in participant_ids:
        if uid == sender_id:
            continue
        meta = await db_conversation_muted(uid, conversation_id)
        if meta:
            continue
        results.append(
            await send_generic_push_to_user(
                uid,
                conversation_id=conversation_id,
                message_id=message_id,
            )
        )
    return results


async def db_conversation_muted(user_id: str, conversation_id: str) -> bool:
    db = get_database()
    doc = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    return bool(doc and doc.get("muted"))


async def _dispatch_fcm(token: str, payload: dict[str, Any]) -> bool:
    if not ensure_firebase():
        return False

    try:
        from firebase_admin import messaging  # noqa: PLC0415
        message = messaging.Message(
            token=token,
            notification=messaging.Notification(
                title=payload["title"],
                body=payload["body"],
            ),
            data={k: str(v) for k, v in payload.get("data", {}).items()},
        )
        messaging.send(message)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("FCM send failed")
        return False