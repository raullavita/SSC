"""Numeric device ID allocation for libsignal ProtocolAddress compatibility."""

from __future__ import annotations

import re

_NUMERIC_DEVICE_RE = re.compile(r"^\d{1,4}$")


def is_valid_device_id(device_id: str) -> bool:
    return bool(device_id and _NUMERIC_DEVICE_RE.match(str(device_id)))


async def _used_device_ids(db, user_id: str) -> set[int]:
    used: set[int] = set()
    async for doc in db.devices.find({"user_id": user_id}):
        raw = str(doc.get("device_id", ""))
        if raw.isdigit():
            used.add(int(raw))
    async for doc in db.prekeys.find({"user_id": user_id}):
        raw = str(doc.get("device_id", ""))
        if raw.isdigit():
            used.add(int(raw))
    return used


async def allocate_next_device_id(db, user_id: str) -> str:
    """Return next free numeric device id (1 for first primary device)."""
    used = await _used_device_ids(db, user_id)
    candidate = 1
    while candidate in used:
        candidate += 1
    if candidate > 9999:
        raise ValueError("device_id_exhausted")
    return str(candidate)


async def allocate_linked_device_id(db, user_id: str) -> str:
    """Linked devices start at 2+ (1 reserved for primary client)."""
    used = await _used_device_ids(db, user_id)
    candidate = 2
    while candidate in used:
        candidate += 1
    if candidate > 9999:
        raise ValueError("device_id_exhausted")
    return str(candidate)