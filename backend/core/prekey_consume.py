"""One-time prekey consume on fetch — Signal X3DH §3.2."""

from __future__ import annotations

from typing import Any

from pymongo import ReturnDocument

from core.signal_policy import public_prekey_bundle

PREKEY_LOW_THRESHOLD = 5


async def consume_one_prekey(db, doc_id: str) -> tuple[dict[str, Any] | None, str | None]:
    """
    Atomically remove the first one-time prekey and return a fetch bundle.
    Returns (bundle_dict, error_detail).
    """
    doc = await db.prekeys.find_one_and_update(
        {"_id": doc_id, "prekeys.0": {"$exists": True}},
        {"$pop": {"prekeys": -1}},
        return_document=ReturnDocument.BEFORE,
    )
    if doc:
        prekeys = list(doc.get("prekeys") or [])
        consumed = prekeys[0] if prekeys else None
        remaining = max(0, len(prekeys) - 1)
        fetch_doc = {**doc, "prekeys": [consumed] if consumed else []}
        bundle = public_prekey_bundle(fetch_doc)
        bundle["prekeys_remaining"] = remaining
        bundle["prekeys_low"] = remaining < PREKEY_LOW_THRESHOLD
        return bundle, None

    doc = await db.prekeys.find_one({"_id": doc_id})
    if not doc:
        return None, "prekey_bundle_not_found"

    remaining = len(doc.get("prekeys") or [])
    bundle = public_prekey_bundle({**doc, "prekeys": []})
    bundle["prekeys_remaining"] = remaining
    bundle["prekeys_low"] = remaining < PREKEY_LOW_THRESHOLD
    return bundle, None


async def count_prekeys(db, user_id: str, device_id: str) -> int:
    doc_id = f"{user_id}:{device_id}"
    doc = await db.prekeys.find_one({"_id": doc_id}, {"prekeys": 1})
    if not doc:
        return 0
    return len(doc.get("prekeys") or [])