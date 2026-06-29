"""
Native push (FCM → Android + APNs via Firebase Admin SDK).
Optional: only active when FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS is set.
"""
import json
import os
from typing import Dict, List, Optional

# Set by database bootstrap
db = None

_firebase_ready = None
_logger = None


def _log():
    global _logger
    if _logger is None:
        import logging
        _logger = logging.getLogger("ssc")
    return _logger


def is_configured() -> bool:
    from core.egress_policy import egress_feature_enabled

    if not egress_feature_enabled("fcm"):
        return False
    return _init_firebase() is True


def _init_firebase() -> bool:
    global _firebase_ready
    if _firebase_ready is not None:
        return _firebase_ready is True
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if not cred_path and not cred_json:
        _firebase_ready = False
        return False
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            _firebase_ready = True
            return True
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
        else:
            cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _log().info("Firebase Admin initialized — native FCM/APNs push enabled")
        _firebase_ready = True
        return True
    except Exception as e:
        _log().warning(f"Firebase Admin init failed: {type(e).__name__} — native push disabled")
        _firebase_ready = False
        return False


def _flatten_data(payload: dict) -> Dict[str, str]:
    """FCM data payloads must be string key/value pairs (Engine 4 — sanitized routing only)."""
    from core.metadata_policy import GENERIC_PUSH_BODY, GENERIC_PUSH_TITLE
    from core.push_payload import ACTIVITY_MESSAGE, sanitize_push_data

    inner = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    merged = {**inner, "type": payload.get("type") or inner.get("type")}
    if payload.get("conversation_id"):
        merged["conversation_id"] = payload["conversation_id"]
    out = sanitize_push_data(merged)
    out["title"] = str(payload.get("title") or GENERIC_PUSH_TITLE)
    out["body"] = str(payload.get("body") or GENERIC_PUSH_BODY)
    out["tag"] = str(payload.get("tag") or "")
    out["silent"] = "1" if payload.get("silent") else "0"
    return out


def should_send_data_only_android(payload: dict, platform: str, silent: bool) -> bool:
    """Android message pushes must be data-only so SscMessagingService can add inline reply (Q.43)."""
    from core.push_payload import ACTIVITY_MESSAGE

    return (
        platform == "android"
        and not silent
        and payload.get("type") == ACTIVITY_MESSAGE
    )


async def send_native_to_users(
    user_ids: List[str],
    payload: dict,
    sender_id: Optional[str] = None,
):
    if db is None or not user_ids or not _init_firebase():
        return
    from firebase_admin import messaging

    tokens = await db.native_push_tokens.find(
        {"user_id": {"$in": user_ids}}, {"_id": 0}
    ).to_list(200)
    if not tokens:
        return

    data = _flatten_data(payload)
    title = payload.get("title") or "SSC"
    body = payload.get("body") or ""
    silent = bool(payload.get("silent"))
    is_call = payload.get("type") == "call"

    for doc in tokens:
        uid = doc["user_id"]
        doc_silent = silent
        if sender_id:
            from core.conversation_mutes import should_silence_push

            conv_id = payload.get("conversation_id")
            if await should_silence_push(uid, conv_id, sender_id):
                doc_silent = True

        fcm_token = doc.get("token")
        if not fcm_token:
            continue

        platform = doc.get("platform") or "android"

        try:
            if doc_silent:
                msg = messaging.Message(data=data, token=fcm_token)
            elif should_send_data_only_android(payload, platform, doc_silent):
                android_cfg = messaging.AndroidConfig(priority="normal")
                msg = messaging.Message(data=data, token=fcm_token, android=android_cfg)
            else:
                channel_id = "ssc_calls" if is_call else "ssc_messages"
                if not is_call and payload.get("conversation_id"):
                    from core.conversation_mutes import android_channel_id_for_conversation

                    channel_id = android_channel_id_for_conversation(payload["conversation_id"])
                android_cfg = messaging.AndroidConfig(
                    priority="high" if is_call else "normal",
                    notification=messaging.AndroidNotification(
                        channel_id=channel_id,
                        sound="default",
                    ),
                )
                apns_cfg = messaging.APNSConfig(
                    headers={"apns-priority": "10" if is_call else "5"},
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(title=title, body=body),
                            sound="default",
                            badge=1,
                        )
                    ),
                )
                msg = messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data=data,
                    token=fcm_token,
                    android=android_cfg,
                    apns=apns_cfg,
                )
            messaging.send(msg)
        except Exception as e:
            err = str(e).lower()
            if "not-found" in err or "unregistered" in err or "invalid" in err:
                await db.native_push_tokens.delete_one({"token": fcm_token})
            else:
                from core.logging_policy import safe_exception_label
                _log().warning(f"native push failed user={uid}: {safe_exception_label(e)}")