"""Per-conversation notification mutes with optional expiry — Q.44."""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import HTTPException

from core.contact_graph import contact_graph_pepper, set_mute
from core.database import db
from core.mute_duration import ALLOWED_MUTE_DURATIONS, muted_until_from_duration
from core.utils import iso, now_utc

COLLECTION_CONVERSATION_MUTES = "conversation_mutes"


def conversation_mute_seal(user_id: str, conversation_id: str) -> str:
    msg = f"conv_mute:{user_id}:{conversation_id}"
    return hmac.new(contact_graph_pepper(), msg.encode("utf-8"), hashlib.sha256).hexdigest()


def android_channel_id_for_conversation(conversation_id: str) -> str:
    """Opaque per-chat Android notification channel id (no PII)."""
    digest = hashlib.sha256(conversation_id.encode("utf-8")).hexdigest()[:12]
    return f"ssc_chat_{digest}"


def _parse_muted_until(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _mute_still_active(doc: Optional[dict]) -> bool:
    if not doc:
        return False
    until = _parse_muted_until(doc.get("muted_until"))
    if until is not None and until <= now_utc():
        return False
    return True


async def _purge_expired_mute(seal: str) -> None:
    await db[COLLECTION_CONVERSATION_MUTES].delete_one({"seal": seal})


async def is_conversation_muted(user_id: str, conversation_id: str) -> bool:
    seal = conversation_mute_seal(user_id, conversation_id)
    doc = await db[COLLECTION_CONVERSATION_MUTES].find_one({"seal": seal}, {"_id": 0})
    if not _mute_still_active(doc):
        if doc:
            await _purge_expired_mute(seal)
        return False
    return True


async def should_silence_push(recipient_id: str, conversation_id: Optional[str], sender_id: Optional[str]) -> bool:
    if conversation_id and await is_conversation_muted(recipient_id, conversation_id):
        return True
    if sender_id:
        from core.contact_graph import is_muted_pair

        if await is_muted_pair(recipient_id, sender_id):
            return True
    return False


async def mutes_map_for_user(user_id: str) -> Dict[str, dict]:
    rows = await db[COLLECTION_CONVERSATION_MUTES].find(
        {"user_id": user_id},
        {"_id": 0, "conversation_id": 1, "muted_until": 1, "seal": 1},
    ).to_list(500)
    out: Dict[str, dict] = {}
    for row in rows:
        conv_id = row.get("conversation_id")
        if not conv_id:
            continue
        if not _mute_still_active(row):
            if row.get("seal"):
                await _purge_expired_mute(row["seal"])
            continue
        until = row.get("muted_until")
        out[conv_id] = {
            "muted": True,
            "muted_until": iso(until) if isinstance(until, datetime) else until,
        }
    return out


async def attach_mute_fields(conversations: List[dict], user_id: str) -> List[dict]:
    mute_map = await mutes_map_for_user(user_id)
    for conv in conversations:
        info = mute_map.get(conv.get("conversation_id"))
        conv["muted"] = bool(info)
        if info and info.get("muted_until"):
            conv["muted_until"] = info["muted_until"]
    return conversations


async def _require_member(user_id: str, conversation_id: str) -> dict:
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user_id not in conv.get("participants", []):
        raise HTTPException(404, "Conversation not found")
    return conv


async def set_conversation_mute(user_id: str, conversation_id: str, *, duration: str) -> dict:
    if duration not in ALLOWED_MUTE_DURATIONS:
        raise HTTPException(400, "Invalid mute duration")
    await _require_member(user_id, conversation_id)
    muted_until = muted_until_from_duration(duration)
    seal = conversation_mute_seal(user_id, conversation_id)
    now = iso(now_utc())
    doc = {
        "seal": seal,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "duration": duration,
        "muted_until": muted_until,
        "updated_at": now,
    }
    await db[COLLECTION_CONVERSATION_MUTES].update_one(
        {"seal": seal},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"muted": True, "muted_until": muted_until, "duration": duration}


async def clear_conversation_mute(user_id: str, conversation_id: str) -> None:
    seal = conversation_mute_seal(user_id, conversation_id)
    await db[COLLECTION_CONVERSATION_MUTES].delete_one({"seal": seal})


async def mute_conversation_for_user(user_id: str, conversation_id: str, *, duration: str) -> dict:
    conv = await _require_member(user_id, conversation_id)
    result = await set_conversation_mute(user_id, conversation_id, duration=duration)
    if not conv.get("is_group"):
        peer_id = next((p for p in conv["participants"] if p != user_id), None)
        if peer_id:
            muted_until = result.get("muted_until")
            await set_mute(user_id, peer_id, muted_flag=True, muted_until=muted_until)
    return result


async def unmute_conversation_for_user(user_id: str, conversation_id: str) -> None:
    conv = await _require_member(user_id, conversation_id)
    await clear_conversation_mute(user_id, conversation_id)
    if not conv.get("is_group"):
        peer_id = next((p for p in conv["participants"] if p != user_id), None)
        if peer_id:
            await set_mute(user_id, peer_id, muted_flag=False)