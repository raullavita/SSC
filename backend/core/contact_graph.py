"""
Server-blind contact graph — seal-based ACL + pepper-encrypted rosters.

Staff browsing Mongo without CONTACT_GRAPH_PEPPER cannot recover who is friends with whom.
See memory/CONTACT_GRAPH_PRIVACY_CHARTER.md.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from core.database import db
from core.utils import iso, now_utc

COLLECTION_SEALS = "contact_seals"
COLLECTION_BLOCKS = "contact_blocks"
COLLECTION_MUTES = "contact_mutes"
COLLECTION_ROSTERS = "contact_rosters"
LEGACY_COLLECTION = "contacts"

ROSTER_VERSION = 1


def contact_graph_pepper() -> bytes:
    raw = (os.environ.get("CONTACT_GRAPH_PEPPER") or "").strip()
    if not raw:
        raw = "ssc-dev-contact-graph-pepper"
    return raw.encode("utf-8")


def _hmac_seal(kind: str, *parts: str) -> str:
    msg = f"{kind}:" + ":".join(parts)
    digest = hmac.new(contact_graph_pepper(), msg.encode("utf-8"), hashlib.sha256).hexdigest()
    return digest


def pair_seal(user_a: str, user_b: str) -> str:
    lo, hi = sorted([user_a, user_b])
    return _hmac_seal("pair", lo, hi)


def block_seal(blocker: str, blocked: str) -> str:
    return _hmac_seal("block", blocker, blocked)


def mute_seal(muter: str, muted: str) -> str:
    return _hmac_seal("mute", muter, muted)


def _roster_aes_key(user_id: str) -> bytes:
    return hmac.new(contact_graph_pepper(), f"roster:{user_id}".encode("utf-8"), hashlib.sha256).digest()


def encrypt_roster_blob(user_id: str, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    plaintext = json.dumps({"v": ROSTER_VERSION, "contacts": entries}, separators=(",", ":")).encode("utf-8")
    iv = os.urandom(12)
    aes = AESGCM(_roster_aes_key(user_id))
    ciphertext = aes.encrypt(iv, plaintext, None)
    return {
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        "iv": base64.b64encode(iv).decode("ascii"),
        "version": ROSTER_VERSION,
    }


def decrypt_roster_blob(user_id: str, doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not doc:
        return []
    iv = base64.b64decode(doc["iv"])
    ciphertext = base64.b64decode(doc["ciphertext"])
    aes = AESGCM(_roster_aes_key(user_id))
    plaintext = aes.decrypt(iv, ciphertext, None)
    payload = json.loads(plaintext.decode("utf-8"))
    contacts = payload.get("contacts") or []
    if not isinstance(contacts, list):
        return []
    return contacts


async def _load_roster_entries(user_id: str) -> List[Dict[str, Any]]:
    doc = await db[COLLECTION_ROSTERS].find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return []
    return decrypt_roster_blob(user_id, doc)


async def _save_roster_entries(user_id: str, entries: List[Dict[str, Any]]) -> None:
    blob = encrypt_roster_blob(user_id, entries)
    now = iso(now_utc())
    await db[COLLECTION_ROSTERS].update_one(
        {"user_id": user_id},
        {
            "$set": {
                **blob,
                "user_id": user_id,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


def _upsert_roster_entry(entries: List[Dict[str, Any]], contact_id: str, **fields) -> List[Dict[str, Any]]:
    out = [e for e in entries if e.get("contact_id") != contact_id]
    row = {"contact_id": contact_id}
    for key, val in fields.items():
        if val is not None:
            row[key] = val
    if "blocked" not in row:
        row["blocked"] = False
    if "muted" not in row:
        row["muted"] = False
    if "created_at" not in row:
        row["created_at"] = iso(now_utc())
    out.append(row)
    return out


def _remove_roster_entry(entries: List[Dict[str, Any]], contact_id: str) -> List[Dict[str, Any]]:
    return [e for e in entries if e.get("contact_id") != contact_id]


async def seal_exists(user_a: str, user_b: str) -> bool:
    seal = pair_seal(user_a, user_b)
    return bool(await db[COLLECTION_SEALS].find_one({"seal": seal}, {"_id": 1}))


async def is_blocked_pair(user_a: str, user_b: str) -> bool:
    if await db[COLLECTION_BLOCKS].find_one({"seal": block_seal(user_a, user_b)}, {"_id": 1}):
        return True
    if await db[COLLECTION_BLOCKS].find_one({"seal": block_seal(user_b, user_a)}, {"_id": 1}):
        return True
    return False


def _mute_doc_active(doc: Optional[dict]) -> bool:
    if not doc:
        return False
    until = doc.get("muted_until")
    if not until:
        return True
    try:
        parsed = datetime.fromisoformat(str(until).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        now = now_utc()
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        return parsed > now
    except ValueError:
        return True


async def is_muted_pair(muter: str, muted: str) -> bool:
    seal = mute_seal(muter, muted)
    doc = await db[COLLECTION_MUTES].find_one({"seal": seal}, {"_id": 0, "muted_until": 1})
    if not _mute_doc_active(doc):
        if doc:
            await db[COLLECTION_MUTES].delete_one({"seal": seal})
            entries = await _load_roster_entries(muter)
            entries = _upsert_roster_entry(entries, muted, muted=False)
            await _save_roster_entries(muter, entries)
        return False
    return True


async def are_contacts(user_a: str, user_b: str) -> bool:
    if user_a == user_b:
        return True
    if not await seal_exists(user_a, user_b):
        return False
    if await is_blocked_pair(user_a, user_b):
        return False
    return True


async def establish_mutual_contact(user_a: str, user_b: str, *, created_at: Optional[str] = None) -> None:
    seal = pair_seal(user_a, user_b)
    ts = created_at or iso(now_utc())
    await db[COLLECTION_SEALS].update_one(
        {"seal": seal},
        {"$setOnInsert": {"seal": seal, "created_at": ts}},
        upsert=True,
    )
    for owner, peer in ((user_a, user_b), (user_b, user_a)):
        entries = await _load_roster_entries(owner)
        entries = _upsert_roster_entry(entries, peer, blocked=False, muted=False, created_at=ts)
        await _save_roster_entries(owner, entries)


async def remove_mutual_contact(user_a: str, user_b: str) -> None:
    seal = pair_seal(user_a, user_b)
    await db[COLLECTION_SEALS].delete_one({"seal": seal})
    for blocker, blocked in ((user_a, user_b), (user_b, user_a)):
        await db[COLLECTION_BLOCKS].delete_one({"seal": block_seal(blocker, blocked)})
        await db[COLLECTION_MUTES].delete_one({"seal": mute_seal(blocker, blocked)})
    for owner in (user_a, user_b):
        entries = await _load_roster_entries(owner)
        entries = _remove_roster_entry(entries, user_b if owner == user_a else user_a)
        await _save_roster_entries(owner, entries)


async def set_block(blocker: str, blocked: str, *, blocked_flag: bool) -> None:
    seal = block_seal(blocker, blocked)
    if blocked_flag:
        await db[COLLECTION_BLOCKS].update_one(
            {"seal": seal},
            {"$setOnInsert": {"seal": seal, "created_at": iso(now_utc())}},
            upsert=True,
        )
    else:
        await db[COLLECTION_BLOCKS].delete_one({"seal": seal})
    entries = await _load_roster_entries(blocker)
    entries = _upsert_roster_entry(entries, blocked, blocked=blocked_flag)
    await _save_roster_entries(blocker, entries)


async def set_mute(
    muter: str,
    muted: str,
    *,
    muted_flag: bool,
    muted_until: Optional[str] = None,
) -> None:
    seal = mute_seal(muter, muted)
    if muted_flag:
        update: Dict[str, Any] = {
            "seal": seal,
            "updated_at": iso(now_utc()),
        }
        if muted_until:
            update["muted_until"] = muted_until
        else:
            update["muted_until"] = None
        await db[COLLECTION_MUTES].update_one(
            {"seal": seal},
            {"$set": update, "$setOnInsert": {"seal": seal, "created_at": iso(now_utc())}},
            upsert=True,
        )
    else:
        await db[COLLECTION_MUTES].delete_one({"seal": seal})
    entries = await _load_roster_entries(muter)
    row_fields: Dict[str, Any] = {"muted": muted_flag}
    if muted_flag and muted_until:
        row_fields["muted_until"] = muted_until
    elif not muted_flag:
        row_fields["muted_until"] = None
    entries = _upsert_roster_entry(entries, muted, **row_fields)
    await _save_roster_entries(muter, entries)


async def get_roster_contact_ids(user_id: str) -> List[str]:
    entries = await _load_roster_entries(user_id)
    return [e["contact_id"] for e in entries if e.get("contact_id")]


async def get_mutual_contact_ids(user_id: str) -> List[str]:
    out: List[str] = []
    for contact_id in await get_roster_contact_ids(user_id):
        if contact_id == user_id:
            continue
        if await are_contacts(user_id, contact_id):
            out.append(contact_id)
    return out


async def get_roster_prefs(user_id: str, contact_id: str) -> Dict[str, Any]:
    entries = await _load_roster_entries(user_id)
    row = next((e for e in entries if e.get("contact_id") == contact_id), None)
    if not row:
        return {"blocked": False, "muted": False, "muted_until": None}
    muted = bool(row.get("muted"))
    muted_until = row.get("muted_until")
    if muted:
        doc = await db[COLLECTION_MUTES].find_one(
            {"seal": mute_seal(user_id, contact_id)},
            {"_id": 0, "muted_until": 1},
        )
        if not _mute_doc_active(doc):
            muted = False
            muted_until = None
        elif doc and doc.get("muted_until"):
            muted_until = doc.get("muted_until")
    return {
        "blocked": bool(row.get("blocked")),
        "muted": muted,
        "muted_until": muted_until,
    }


async def migrate_legacy_contacts() -> int:
    """One-time migration from plaintext contacts collection to blind graph."""
    migrated = 0
    cursor = db[LEGACY_COLLECTION].find({}, {"_id": 0})
    seen_pairs: set[str] = set()
    async for row in cursor:
        user_id = row.get("user_id")
        contact_id = row.get("contact_id")
        if not user_id or not contact_id or user_id == contact_id:
            continue
        lo, hi = sorted([user_id, contact_id])
        key = f"{lo}|{hi}"
        if key in seen_pairs:
            continue
        reverse = await db[LEGACY_COLLECTION].find_one(
            {"user_id": contact_id, "contact_id": user_id},
            {"_id": 0, "blocked": 1, "muted": 1, "created_at": 1},
        )
        if not reverse:
            continue
        seen_pairs.add(key)
        created_at = row.get("created_at") or iso(now_utc())
        await establish_mutual_contact(user_id, contact_id, created_at=created_at)
        if row.get("blocked"):
            await set_block(user_id, contact_id, blocked_flag=True)
        if reverse.get("blocked"):
            await set_block(contact_id, user_id, blocked_flag=True)
        if row.get("muted"):
            await set_mute(user_id, contact_id, muted_flag=True)
        if reverse.get("muted"):
            await set_mute(contact_id, user_id, muted_flag=True)
        migrated += 1
    if migrated:
        await db[LEGACY_COLLECTION].delete_many({})
    return migrated