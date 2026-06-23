"""
Push notification helpers - extracted for organization.
"""
import json
import asyncio
import logging
from pywebpush import webpush, WebPushException
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

_logger = logging.getLogger("ssc")

# Will be set by server
db = None
manager = None
VAPID_PRIVATE = ''
VAPID_EMAIL = ''

async def _offline_recipients(recipients: list) -> list:
    if db is None or manager is None:
        return []
    online = set(manager.user_sockets.keys())
    return [u for u in recipients if u not in online]


async def send_push(recipients: list, payload: dict, sender_id: str = None):
    if db is None or manager is None:
        return
    recipients = await _offline_recipients(recipients)
    if not recipients:
        return

    # Web Push (PWA / browser)
    from core.egress_policy import egress_feature_enabled

    if VAPID_PRIVATE and egress_feature_enabled("web_push"):
        subs = await db.push_subscriptions.find({"user_id": {"$in": recipients}}).to_list(500)
        for s in subs:
            p = dict(payload)
            if sender_id:
                muted = await db.contacts.find_one({
                    "user_id": s["user_id"],
                    "contact_id": sender_id,
                    "muted": True,
                })
                if muted:
                    p["silent"] = True
            try:
                webpush(
                    subscription_info={"endpoint": s["endpoint"], "keys": s["keys"]},
                    data=json.dumps(p),
                    vapid_private_key=VAPID_PRIVATE,
                    vapid_claims={"sub": f"mailto:{VAPID_EMAIL}"},
                )
            except WebPushException as e:
                if e.response is not None and e.response.status_code in (404, 410):
                    await db.push_subscriptions.delete_one({"endpoint": s["endpoint"]})
            except Exception as e:
                _logger.warning(f"push failed: {type(e).__name__}")

    # Native FCM / APNs (Capacitor Android & iOS)
    try:
        import native_push as np
        if np.is_configured():
            await np.send_native_to_users(recipients, payload, sender_id)
    except Exception as e:
        _logger.warning(f"native push dispatch failed: {type(e).__name__}")

async def send_push_for_message(conv: dict, sender: dict, msg: dict):
    recipients = [u for u in conv["participants"] if u != sender["user_id"]]
    if conv.get("is_group"):
        title = "Group chat"
    else:
        title = f"@{sender['username']}"
    body_text = "New encrypted message"
    if msg.get("message_type") == "image":
        body_text = "Sent a photo"
    elif msg.get("message_type") == "file":
        body_text = "Sent a file"
    elif msg.get("message_type") == "voice":
        body_text = "Sent a voice note"
    payload = {
        "title": title, "body": body_text,
        "conversation_id": conv["conversation_id"],
        "tag": conv["conversation_id"],
        "type": "message",
        "data": {"conversation_id": conv["conversation_id"]},
    }
    await send_push(recipients, payload, sender["user_id"])

async def send_push_for_call(to_user: str, from_user: dict, mode: str = "audio", conv_id: str = None, group: bool = False):
    if db is None or manager is None:
        return
    if to_user in manager.user_sockets:
        return
    title = f"Incoming {mode} call"
    body_text = f"from @{from_user.get('username', 'user')}"
    if group:
        body_text = f"Group {mode} call"
    payload = {
        "title": title,
        "body": body_text,
        "type": "call",
        "data": {
            "mode": mode,
            "from": from_user.get("user_id"),
            "conversation_id": conv_id,
            "group": group,
        },
        "tag": f"call-{to_user}",
        "vibrate": [200, 100, 200],
        "renotify": True,
    }
    await send_push([to_user], payload, from_user.get("user_id"))

async def send_push_for_friend_request(to_user_id: str, from_user: dict):
    if db is None or manager is None:
        return
    if to_user_id in manager.user_sockets:
        return
    payload = {
        "title": "New friend request",
        "body": f"from @{from_user.get('username', 'user')}",
        "type": "friend_request",
        "data": {"from": from_user.get("user_id")},
        "tag": f"friend-{to_user_id}",
    }
    await send_push([to_user_id], payload, from_user.get("user_id"))

async def send_push_for_friend_accept(to_user_id: str, from_user: dict):
    if db is None:
        return
    payload = {
        "title": "Friend request accepted",
        "body": f"by @{from_user.get('username', 'user')}",
        "type": "friend_accept",
        "data": {"from": from_user.get("user_id")},
        "tag": f"friend-accept-{to_user_id}",
    }
    await send_push([to_user_id], payload, from_user.get("user_id"))

async def send_push_for_status(to_user_id: str, from_user: dict):
    if db is None or manager is None:
        return
    if to_user_id in manager.user_sockets:
        return
    payload = {
        "title": f"@{from_user.get('username', 'user')}",
        "body": "Posted a new status",
        "type": "status",
        "data": {"from": from_user.get("user_id"), "author_username": from_user.get("username")},
        "tag": f"status-{from_user.get('user_id')}",
    }
    await send_push([to_user_id], payload, from_user.get("user_id"))

async def send_push_for_group_added(to_user_id: str, from_user: dict, conv: dict):
    if db is None or manager is None:
        return
    if to_user_id in manager.user_sockets:
        return
    group_name = "Group chat"
    payload = {
        "title": "Added to group",
        "body": f"@{from_user.get('username', 'user')} added you to {group_name}",
        "type": "group_event",
        "data": {
            "conversation_id": conv.get("conversation_id"),
            "from": from_user.get("user_id"),
            "group_name": group_name,
        },
        "tag": f"group-{conv.get('conversation_id')}",
    }
    await send_push([to_user_id], payload, from_user.get("user_id"))
