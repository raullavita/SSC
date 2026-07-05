"""Per-user conversation metadata (pin/mute/privacy) — minimal fields — Engine 4."""

from __future__ import annotations

from typing import Any

from core.conversation_privacy_policy import PRIVACY_OVERRIDE_DB_FIELDS


async def get_meta_map(db, user_id: str, conversation_ids: list[str]) -> dict[str, dict]:
    if not conversation_ids:
        return {}
    cursor = db.conversation_meta.find(
        {"user_id": user_id, "conversation_id": {"$in": conversation_ids}}
    )
    out: dict[str, dict] = {}
    async for doc in cursor:
        row = {
            "pinned": bool(doc.get("pinned")),
            "muted": bool(doc.get("muted")),
            "unread_count": int(doc.get("unread_count", 0)),
        }
        for api_key, db_key in PRIVACY_OVERRIDE_DB_FIELDS.items():
            if db_key in doc:
                row[db_key] = doc[db_key]
        out[doc["conversation_id"]] = row
    return out


async def upsert_meta(
    db,
    user_id: str,
    conversation_id: str,
    *,
    pinned: bool | None = None,
    muted: bool | None = None,
) -> dict[str, Any]:
    updates: dict[str, Any] = {"user_id": user_id, "conversation_id": conversation_id}
    if pinned is not None:
        updates["pinned"] = pinned
    if muted is not None:
        updates["muted"] = muted

    existing = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    if existing:
        await db.conversation_meta.update_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            {"$set": updates},
        )
    else:
        updates.setdefault("pinned", False)
        updates.setdefault("muted", False)
        updates.setdefault("unread_count", 0)
        await db.conversation_meta.insert_one(updates)

    doc = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    return doc or updates


async def upsert_privacy_meta(
    db,
    user_id: str,
    conversation_id: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    set_fields: dict[str, Any] = {}
    unset_fields: list[str] = []
    for api_key, value in patch.items():
        db_key = PRIVACY_OVERRIDE_DB_FIELDS.get(api_key)
        if not db_key:
            continue
        if value is None:
            unset_fields.append(db_key)
        else:
            set_fields[db_key] = value

    existing = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    update: dict[str, Any] = {}
    if set_fields:
        update["$set"] = {
            **set_fields,
            "user_id": user_id,
            "conversation_id": conversation_id,
        }
    if unset_fields:
        update["$unset"] = {key: "" for key in unset_fields}

    if not update:
        return existing or {"user_id": user_id, "conversation_id": conversation_id}

    if existing:
        await db.conversation_meta.update_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            update,
        )
    else:
        base = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "pinned": False,
            "muted": False,
            "unread_count": 0,
            **set_fields,
        }
        await db.conversation_meta.insert_one(base)

    doc = await db.conversation_meta.find_one(
        {"user_id": user_id, "conversation_id": conversation_id}
    )
    return doc or {"user_id": user_id, "conversation_id": conversation_id}