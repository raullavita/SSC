"""Web Push + native FCM/APNs subscription routes."""
from fastapi import APIRouter, Depends

from core.auth import get_current_user
from core.config import VAPID_PUBLIC
from core.database import db
from core.logging_config import logger
from core.models import NativePushSubscribeIn, PushSubscribeIn
from core.utils import iso, now_utc

router = APIRouter()

try:
    import native_push as native_push_module
except ImportError:
    native_push_module = None


@router.get("/public-key")
async def push_public_key():
    return {
        "vapid_public_key": VAPID_PUBLIC,
        "native_push_enabled": bool(native_push_module and native_push_module.is_configured()),
    }


@router.post("/subscribe")
async def push_subscribe(body: PushSubscribeIn, current=Depends(get_current_user)):
    sub = {
        "user_id": current["user_id"],
        "endpoint": body.endpoint,
        "keys": body.keys,
        "channel": "web",
        "created_at": iso(now_utc()),
    }
    try:
        await db.push_subscriptions.update_one(
            {"endpoint": body.endpoint}, {"$set": sub}, upsert=True
        )
    except Exception as e:
        logger.warning(f"push subscribe upsert failed: {type(e).__name__}")
    return {"ok": True}


@router.post("/unsubscribe")
async def push_unsubscribe(body: PushSubscribeIn, current=Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": current["user_id"]})
    return {"ok": True}


@router.post("/native/subscribe")
async def native_push_subscribe(body: NativePushSubscribeIn, current=Depends(get_current_user)):
    doc = {
        "user_id": current["user_id"],
        "token": body.token.strip(),
        "platform": body.platform,
        "created_at": iso(now_utc()),
    }
    await db.native_push_tokens.update_one(
        {"token": doc["token"]},
        {"$set": doc},
        upsert=True,
    )
    logger.info(f"native push token registered user={current['user_id']} platform={body.platform}")
    return {"ok": True}


@router.post("/native/unsubscribe")
async def native_push_unsubscribe(body: NativePushSubscribeIn, current=Depends(get_current_user)):
    await db.native_push_tokens.delete_one({
        "token": body.token.strip(),
        "user_id": current["user_id"],
    })
    return {"ok": True}