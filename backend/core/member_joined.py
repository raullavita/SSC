"""Group member join timestamps — Q.27 (shared metadata for members)."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Dict, List, Optional

from core.utils import iso, now_utc


def _fallback_joined_at(conv: dict) -> str:
    created = conv.get("created_at")
    if created:
        if isinstance(created, datetime):
            return iso(created)
        return str(created)
    return iso(now_utc())


def build_member_joined_at_for_participants(
    participant_ids: List[str],
    *,
    joined_at: str,
) -> Dict[str, str]:
    return {pid: joined_at for pid in participant_ids}


def ensure_member_joined_at(conv: dict) -> dict:
    participants = list(conv.get("participants") or [])
    if not participants:
        return conv
    joined = dict(conv.get("member_joined_at") or {})
    fallback = _fallback_joined_at(conv)
    changed = False
    for pid in participants:
        if pid not in joined:
            joined[pid] = fallback
            changed = True
    if not changed and conv.get("member_joined_at"):
        return conv
    return {**conv, "member_joined_at": joined}


def joined_at_after_member_added(
    conv: dict,
    new_member_ids: List[str],
    *,
    at: Optional[datetime] = None,
) -> Dict[str, str]:
    enriched = ensure_member_joined_at(conv)
    joined = dict(enriched.get("member_joined_at") or {})
    ts = iso(at or now_utc())
    for uid in new_member_ids:
        joined[uid] = ts
    return joined


def joined_at_after_member_removed(conv: dict, removed_user_id: str) -> Dict[str, str]:
    joined = dict(ensure_member_joined_at(conv).get("member_joined_at") or {})
    joined.pop(removed_user_id, None)
    return joined


def member_joined_at_for_api(conv: dict) -> Dict[str, str]:
    return deepcopy(ensure_member_joined_at(conv).get("member_joined_at") or {})


def enrich_members_with_joined_at(
    members: List[Optional[dict]],
    joined_map: Dict[str, str],
) -> List[dict]:
    out: List[dict] = []
    for member in members:
        if not member:
            continue
        uid = member.get("user_id")
        row = dict(member)
        if uid and uid in joined_map:
            row["joined_at"] = joined_map[uid]
        out.append(row)
    return out