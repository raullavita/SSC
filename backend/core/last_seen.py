"""last_seen minimization — Engine 4 Steps 4.2–4.3."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from core.metadata_policy import (
    LAST_SEEN_ONLINE_WINDOW_SEC,
    LAST_SEEN_STORAGE_TTL_DAYS,
    LAST_SEEN_WRITE_INTERVAL_SEC,
)
from core.utils import iso, now_utc

# Coarsening buckets (age → round-down interval)
_COARSEN_15M = 15 * 60
_COARSEN_1H = 60 * 60
_COARSEN_1D = 24 * 60 * 60


def _parse_iso(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError):
        return None


def last_seen_age_seconds(raw: Optional[str], *, now: Optional[datetime] = None) -> Optional[float]:
    dt = _parse_iso(raw) if raw else None
    if dt is None:
        return None
    ref = now or now_utc()
    return (ref - dt).total_seconds()


def last_seen_expired(raw: Optional[str], *, now: Optional[datetime] = None) -> bool:
    age = last_seen_age_seconds(raw, now=now)
    if age is None:
        return True
    return age > LAST_SEEN_STORAGE_TTL_DAYS * 86400


def should_write_last_seen(raw: Optional[str], *, now: Optional[datetime] = None) -> bool:
    """Throttle DB writes — at most once per LAST_SEEN_WRITE_INTERVAL_SEC."""
    age = last_seen_age_seconds(raw, now=now)
    if age is None:
        return True
    return age >= LAST_SEEN_WRITE_INTERVAL_SEC


def coarsen_last_seen(raw: Optional[str], *, now: Optional[datetime] = None) -> Optional[str]:
    """Round peer-visible last_seen down to coarse buckets."""
    dt = _parse_iso(raw) if raw else None
    if dt is None:
        return None
    ref = now or now_utc()
    age = (ref - dt).total_seconds()
    if age < 0 or age > LAST_SEEN_STORAGE_TTL_DAYS * 86400:
        return None
    if age < 3600:
        bucket = _COARSEN_15M
    elif age < 86400:
        bucket = _COARSEN_1H
    else:
        bucket = _COARSEN_1D
    epoch = int(dt.timestamp())
    coarsened = datetime.fromtimestamp(epoch - (epoch % bucket), tz=timezone.utc)
    return iso(coarsened)


def project_peer_presence(
    raw: Optional[str],
    *,
    now: Optional[datetime] = None,
    visibility: str = "contacts",
) -> Dict[str, Any]:
    """
    Peer-visible presence — respects last_seen privacy (hidden / online_only / contacts).
    """
    if visibility == "hidden":
        return {"online": False, "last_seen": None}
    if last_seen_expired(raw, now=now):
        return {"online": False, "last_seen": None}
    age = last_seen_age_seconds(raw, now=now)
    if age is None:
        return {"online": False, "last_seen": None}
    if age < LAST_SEEN_ONLINE_WINDOW_SEC:
        return {"online": True, "last_seen": None}
    if visibility == "online_only":
        return {"online": False, "last_seen": None}
    return {"online": False, "last_seen": coarsen_last_seen(raw, now=now)}


async def touch_last_seen(db, user_id: str) -> None:
    """Update last_seen if write interval elapsed and user shares presence."""
    from core.privacy_settings import should_store_last_seen

    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "last_seen": 1, "privacy": 1})
    if not should_store_last_seen(doc):
        return
    raw = doc.get("last_seen") if doc else None
    if not should_write_last_seen(raw):
        return
    await db.users.update_one({"user_id": user_id}, {"$set": {"last_seen": iso(now_utc())}})


def project_user_for_peer(
    user: Optional[dict],
    *,
    now: Optional[datetime] = None,
    viewer_is_contact: bool = True,
) -> Optional[dict]:
    """Apply presence + profile-photo privacy to a user document returned to another user."""
    if not user:
        return None
    from core.privacy_settings import apply_profile_photo_for_viewer, last_seen_visibility

    visibility = last_seen_visibility(user)
    presence = project_peer_presence(user.get("last_seen"), now=now, visibility=visibility)
    out = {k: v for k, v in user.items() if k not in ("last_seen", "privacy")}
    out["online"] = presence["online"]
    out["last_seen"] = presence["last_seen"]
    return apply_profile_photo_for_viewer(out, user, viewer_is_contact=viewer_is_contact)