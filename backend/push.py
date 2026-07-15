"""Push notification dispatch — metadata-minimal with rich kind labels — Engine 4."""

from __future__ import annotations

import logging
from typing import Any

from core.firebase_init import ensure_firebase
from core.push_payload import build_generic_push, build_missed_call_push
from core.push_rich_policy import resolve_conversation_label
from db import get_database

logger = logging.getLogger("ssc")


async def _recipient_push_rich_labels(db, user_id: str) -> bool:
    user = await db.users.find_one({"_id": user_id}, {"privacy_settings": 1})
    settings = (user or {}).get("privacy_settings") or {}
    return bool(settings.get("push_rich_labels", False))


async def send_generic_push_to_user(
    user_id: str,
    *,
    conversation_id: str | None = None,
    message_id: str | None = None,
    kind: str | None = "message",
) -> dict[str, Any]:
    """Send generic push to all tokens registered for a user."""
    db = get_database()
    extra: dict[str, Any] = {
        k: v
        for k, v in {
            "conversation_id": conversation_id,
            "message_id": message_id,
            "kind": kind or "message",
        }.items()
        if v
    }
    if conversation_id and await _recipient_push_rich_labels(db, user_id):
        label = await resolve_conversation_label(
            db,
            conversation_id=conversation_id,
            recipient_id=user_id,
        )
        if label:
            extra["conversation_label"] = label

    payload = build_generic_push(extra)

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
    kind: str | None = "message",
    skip_kinds: frozenset[str] | None = None,
) -> list[dict[str, Any]]:
    if skip_kinds and kind in skip_kinds:
        return []
    results = []
    from core.block_policy import should_deliver_to_participant
    from db import get_database

    db = get_database()
    for uid in participant_ids:
        if uid == sender_id:
            continue
        if not await should_deliver_to_participant(db, sender_id, uid):
            continue
        meta = await db_conversation_muted(uid, conversation_id)
        if meta:
            continue
        results.append(
            await send_generic_push_to_user(
                uid,
                conversation_id=conversation_id,
                message_id=message_id,
                kind=kind,
            )
        )
    return results


async def send_missed_call_push_to_user(
    user_id: str,
    *,
    conversation_id: str | None = None,
    call_id: str | None = None,
) -> dict[str, Any]:
    """Notify callee of missed/declined call — generic body only."""
    db = get_database()
    extra: dict[str, Any] = {
        k: v
        for k, v in {
            "conversation_id": conversation_id,
            "call_id": call_id,
            "kind": "call",
        }.items()
        if v
    }
    if conversation_id and await _recipient_push_rich_labels(db, user_id):
        label = await resolve_conversation_label(
            db,
            conversation_id=conversation_id,
            recipient_id=user_id,
        )
        if label:
            extra["conversation_label"] = label

    payload = build_missed_call_push(extra)
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


async def db_conversation_muted(user_id: str, conversation_id: str) -> bool:
    db = get_database()
    doc = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    return bool(doc and doc.get("muted"))


def _is_fcm_token(token: str) -> bool:
    """Electron/desktop clients use local OS notifications, not FCM."""
    if not token or token.startswith("ssc-electron-"):
        return False
    return True


async def _dispatch_fcm(token: str, payload: dict[str, Any]) -> bool:
    if not _is_fcm_token(token):
        return False
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