"""Friend request policy — pending contacts — Phase C1."""

from __future__ import annotations

FRIEND_REQUEST_STATUSES = frozenset({"pending", "accepted", "declined"})


def engine_friend_requests_ready() -> bool:
    return bool(FRIEND_REQUEST_STATUSES)