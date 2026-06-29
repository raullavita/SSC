"""One-time delivery tokens for unidentified message send — Q.52."""
from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from typing import Any, Dict, Optional

from core.database import db
from core.sealed_sender_policy import COLLECTION_DELIVERY_TOKENS, SEALED_DELIVERY_TOKEN_TTL_SEC
from core.utils import iso, now_utc


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def mint_delivery_token(user_id: str, conversation_id: str) -> Dict[str, Any]:
    token = secrets.token_urlsafe(32)
    now = now_utc()
    expires = now + timedelta(seconds=SEALED_DELIVERY_TOKEN_TTL_SEC)
    await db[COLLECTION_DELIVERY_TOKENS].insert_one(
        {
            "token_hash": _hash_token(token),
            "conversation_id": conversation_id,
            "issued_by": user_id,
            "created_at": now,
            "expires_at": expires,
            "consumed_at": None,
        }
    )
    return {
        "token": token,
        "expires_at": iso(expires),
        "expires_in_sec": SEALED_DELIVERY_TOKEN_TTL_SEC,
    }


async def consume_delivery_token(token: str, conversation_id: str) -> Optional[str]:
    """Validate and burn a delivery token. Returns issuer user_id for rate-limit accounting."""
    if not token or not token.strip():
        return None
    doc = await db[COLLECTION_DELIVERY_TOKENS].find_one({"token_hash": _hash_token(token.strip())})
    if not doc:
        return None
    if doc.get("conversation_id") != conversation_id:
        return None
    if doc.get("consumed_at"):
        return None
    expires = doc.get("expires_at")
    if expires and expires < now_utc():
        return None
    now = now_utc()
    await db[COLLECTION_DELIVERY_TOKENS].update_one(
        {"token_hash": doc["token_hash"]},
        {"$set": {"consumed_at": now}},
    )
    return doc.get("issued_by")