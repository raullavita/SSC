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

from core.push_payload import (
    ACTIVITY_CALL,
    ACTIVITY_FRIEND_ACCEPT,
    ACTIVITY_FRIEND_REQUEST,
    ACTIVITY_GROUP_EVENT,
    ACTIVITY_MESSAGE,
    ACTIVITY_STATUS,
    build_generic_push,
)

_logger = logging.getLogger("ssc")

# Will be set by server
db = None
manager = None
VAPID_PRIVATE = ''
VAPID_EMAIL = ''

async def _offline_recipients(recipients: list) -> list:
    if db is None or manager is None:
        return []
    from core.ws_pubsub import is_user_online_global

    offline = []
    for uid in recipients:
        local = manager.is_locally_connected(uid)
        if await is_user_online_global(uid, locally_connected=local):
            continue
        offline.append(uid)
    return offline


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
                from core.conversation_mutes import should_silence_push

                conv_id = payload.get("conversation_id")
                if await should_silence_push(s["user_id"], conv_id, sender_id):
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
    payload = build_generic_push(
        ACTIVITY_MESSAGE,
        conversation_id=conv["conversation_id"],
        tag=conv["conversation_id"],
    )
    await send_push(recipients, payload, sender["user_id"])

async def send_push_for_call_end(to_user: str, from_user: dict):
    """Silent native push so background clients stop ringing when the caller hangs up."""
    if db is None or not to_user:
        return
    payload = build_generic_push(
        ACTIVITY_CALL,
        tag=f"call-end-{to_user}",
        extra_data={
            "type": "call-end",
            "from": from_user.get("user_id"),
        },
        silent=True,
    )
    try:
        import native_push as np
        if np.is_configured():
            await np.send_native_to_users([to_user], payload, from_user.get("user_id"))
    except Exception as e:
        _logger.warning(f"native call-end push failed: {type(e).__name__}")


async def send_push_for_call(to_user: str, from_user: dict, mode: str = "audio", conv_id: str = None, group: bool = False):
    if db is None or manager is None:
        return
    payload = build_generic_push(
        ACTIVITY_CALL,
        conversation_id=conv_id,
        tag=f"call-{to_user}",
        extra_data={
            "mode": mode,
            "from": from_user.get("user_id"),
            "group": group,
        },
        vibrate=[200, 100, 200],
    )
    # Always deliver native call alerts — WS may be alive while the app is backgrounded.
    try:
        import native_push as np
        if np.is_configured():
            await np.send_native_to_users([to_user], payload, from_user.get("user_id"))
            return
    except Exception as e:
        _logger.warning(f"native call push failed: {type(e).__name__}")
    if to_user not in manager.user_sockets:
        await send_push([to_user], payload, from_user.get("user_id"))

async def send_push_for_friend_request(to_user_id: str, from_user: dict):
    if db is None or manager is None:
        return
    payload = build_generic_push(
        ACTIVITY_FRIEND_REQUEST,
        tag=f"friend-{to_user_id}",
        extra_data={"from": from_user.get("user_id")},
    )
    await send_push([to_user_id], payload, from_user.get("user_id"))

async def send_push_for_friend_accept(to_user_id: str, from_user: dict):
    if db is None:
        return
    payload = build_generic_push(
        ACTIVITY_FRIEND_ACCEPT,
        tag=f"friend-accept-{to_user_id}",
        extra_data={"from": from_user.get("user_id")},
    )
    await send_push([to_user_id], payload, from_user.get("user_id"))

async def send_push_for_status(to_user_id: str, from_user: dict):
    if db is None or manager is None:
        return
    if to_user_id in manager.user_sockets:
        return
    payload = build_generic_push(
        ACTIVITY_STATUS,
        tag=f"status-{from_user.get('user_id')}",
        extra_data={"from": from_user.get("user_id")},
    )
    await send_push([to_user_id], payload, from_user.get("user_id"))

async def send_push_for_group_added(to_user_id: str, from_user: dict, conv: dict):
    if db is None or manager is None:
        return
    if to_user_id in manager.user_sockets:
        return
    payload = build_generic_push(
        ACTIVITY_GROUP_EVENT,
        conversation_id=conv.get("conversation_id"),
        tag=f"group-{conv.get('conversation_id')}",
        extra_data={"from": from_user.get("user_id")},
    )
    await send_push([to_user_id], payload, from_user.get("user_id"))