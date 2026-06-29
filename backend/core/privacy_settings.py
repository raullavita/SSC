"""Per-user privacy toggles — Q.6 (read receipts, typing, last seen, profile photo)."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Literal, Optional

from core.database import db

LastSeenVisibility = Literal["hidden", "online_only", "contacts"]
ProfilePhotoVisibility = Literal["hidden", "contacts"]

DEFAULT_PRIVACY: Dict[str, Any] = {
    "read_receipts": True,
    "typing_indicators": True,
    "last_seen": "contacts",
    "profile_photo": "contacts",
    "sealed_sender": True,
}

LAST_SEEN_OPTIONS: tuple[str, ...] = ("hidden", "online_only", "contacts")
PROFILE_PHOTO_OPTIONS: tuple[str, ...] = ("hidden", "contacts")


def privacy_from_user(user: Optional[dict]) -> Dict[str, Any]:
    raw = (user or {}).get("privacy") if user else None
    if not isinstance(raw, dict):
        return dict(DEFAULT_PRIVACY)
    out = dict(DEFAULT_PRIVACY)
    if isinstance(raw.get("read_receipts"), bool):
        out["read_receipts"] = raw["read_receipts"]
    if isinstance(raw.get("typing_indicators"), bool):
        out["typing_indicators"] = raw["typing_indicators"]
    if raw.get("last_seen") in LAST_SEEN_OPTIONS:
        out["last_seen"] = raw["last_seen"]
    if raw.get("profile_photo") in PROFILE_PHOTO_OPTIONS:
        out["profile_photo"] = raw["profile_photo"]
    if isinstance(raw.get("sealed_sender"), bool):
        out["sealed_sender"] = raw["sealed_sender"]
    return out


def normalize_privacy_patch(patch: Optional[dict]) -> Dict[str, Any]:
    if not patch or not isinstance(patch, dict):
        return {}
    out: Dict[str, Any] = {}
    if "read_receipts" in patch:
        if not isinstance(patch["read_receipts"], bool):
            raise ValueError("privacy.read_receipts must be a boolean")
        out["read_receipts"] = patch["read_receipts"]
    if "typing_indicators" in patch:
        if not isinstance(patch["typing_indicators"], bool):
            raise ValueError("privacy.typing_indicators must be a boolean")
        out["typing_indicators"] = patch["typing_indicators"]
    if "last_seen" in patch:
        mode = patch["last_seen"]
        if mode not in LAST_SEEN_OPTIONS:
            allowed = ", ".join(LAST_SEEN_OPTIONS)
            raise ValueError(f"privacy.last_seen must be one of: {allowed}")
        out["last_seen"] = mode
    if "profile_photo" in patch:
        mode = patch["profile_photo"]
        if mode not in PROFILE_PHOTO_OPTIONS:
            allowed = ", ".join(PROFILE_PHOTO_OPTIONS)
            raise ValueError(f"privacy.profile_photo must be one of: {allowed}")
        out["profile_photo"] = mode
    if "sealed_sender" in patch:
        if not isinstance(patch["sealed_sender"], bool):
            raise ValueError("privacy.sealed_sender must be a boolean")
        out["sealed_sender"] = patch["sealed_sender"]
    return out


def merge_privacy(current: Optional[dict], patch: dict) -> Dict[str, Any]:
    base = privacy_from_user({"privacy": current} if current else None)
    base.update(patch)
    return base


def privacy_public_config() -> Dict[str, Any]:
    return {
        "defaults": dict(DEFAULT_PRIVACY),
        "last_seen_options": list(LAST_SEEN_OPTIONS),
        "profile_photo_options": list(PROFILE_PHOTO_OPTIONS),
    }


def read_receipts_enabled(user: Optional[dict]) -> bool:
    return privacy_from_user(user)["read_receipts"]


def typing_indicators_enabled(user: Optional[dict]) -> bool:
    return privacy_from_user(user)["typing_indicators"]


def last_seen_visibility(user: Optional[dict]) -> LastSeenVisibility:
    return privacy_from_user(user)["last_seen"]


def profile_photo_visibility(user: Optional[dict]) -> ProfilePhotoVisibility:
    return privacy_from_user(user)["profile_photo"]


def should_store_last_seen(user: Optional[dict]) -> bool:
    return last_seen_visibility(user) != "hidden"


def apply_profile_photo_for_viewer(
    user_out: dict,
    owner: Optional[dict],
    *,
    viewer_is_contact: bool,
) -> dict:
    visibility = profile_photo_visibility(owner)
    if visibility == "hidden":
        user_out["avatar"] = None
    elif visibility == "contacts" and not viewer_is_contact:
        user_out["avatar"] = None
    return user_out


async def privacy_map_for_users(user_ids: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    ids = list({uid for uid in user_ids if uid})
    if not ids:
        return {}
    cur = db.users.find({"user_id": {"$in": ids}}, {"user_id": 1, "privacy": 1, "_id": 0})
    out: Dict[str, Dict[str, Any]] = {}
    async for doc in cur:
        out[doc["user_id"]] = privacy_from_user(doc)
    return out


async def filter_reads_for_viewer(
    reads: List[dict],
    viewer_id: str,
    participant_ids: Iterable[str],
) -> List[dict]:
    pmap = await privacy_map_for_users(participant_ids)
    viewer_privacy = pmap.get(viewer_id, DEFAULT_PRIVACY)
    viewer_wants = viewer_privacy.get("read_receipts", True)
    filtered: List[dict] = []
    for row in reads:
        uid = row.get("user_id")
        if uid == viewer_id:
            filtered.append(row)
            continue
        if not viewer_wants:
            continue
        if not pmap.get(uid, DEFAULT_PRIVACY).get("read_receipts", True):
            continue
        filtered.append(row)
    return filtered