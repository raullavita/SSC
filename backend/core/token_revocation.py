"""Session revocation — Mongo + Redis — Engine 5."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from core.session_policy import SESSION_COLLECTION
from core.session_ttl import session_expires_at
from db import get_database, get_redis


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _redis_set_session(jti: str, user_id: str, ttl_seconds: int) -> None:
    redis = await get_redis()
    if redis is None:
        return
    try:
        await redis.setex(f"session:{jti}", ttl_seconds, user_id)
    except Exception as exc:
        logger.warning("redis_set_session failed for jti=%s: %s", jti, exc)


async def _redis_revoke(jti: str, ttl_seconds: int) -> None:
    redis = await get_redis()
    if redis is None:
        return
    try:
        await redis.delete(f"session:{jti}")
        await redis.setex(f"revoked:{jti}", ttl_seconds, "1")
    except Exception as exc:
        logger.warning("redis_revoke failed for jti=%s: %s", jti, exc)


async def register_session(user_id: str, token: str, jti: str) -> None:
    db = get_database()
    expires = session_expires_at()
    doc = {
        "_id": jti,
        "user_id": user_id,
        "token_hash": _token_hash(token),
        "expires_at": expires,
        "revoked": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db[SESSION_COLLECTION].insert_one(doc)
    ttl = int((expires - datetime.now(timezone.utc)).total_seconds())
    await _redis_set_session(jti, user_id, max(ttl, 60))


async def is_session_revoked(jti: str) -> bool:
    redis = await get_redis()
    if redis is not None:
        try:
            if await redis.get(f"revoked:{jti}"):
                return True
            active = await redis.get(f"session:{jti}")
            if active:
                return False
        except Exception as exc:
            logger.warning("redis session lookup failed for jti=%s: %s", jti, exc)

    db = get_database()
    doc = await db[SESSION_COLLECTION].find_one({"_id": jti})
    if not doc:
        return True
    return bool(doc.get("revoked"))


async def revoke_session(jti: str) -> None:
    db = get_database()
    doc = await db[SESSION_COLLECTION].find_one({"_id": jti})
    ttl = 3600
    if doc and doc.get("expires_at"):
        exp = doc["expires_at"]
        if hasattr(exp, "tzinfo") and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        ttl = max(int((exp - datetime.now(timezone.utc)).total_seconds()), 60)
    await db[SESSION_COLLECTION].update_one({"_id": jti}, {"$set": {"revoked": True}})
    await _redis_revoke(jti, ttl)


async def revoke_all_user_sessions(user_id: str) -> int:
    db = get_database()
    cursor = db[SESSION_COLLECTION].find({"user_id": user_id, "revoked": False})
    count = 0
    async for doc in cursor:
        await revoke_session(doc["_id"])
        count += 1
    return count