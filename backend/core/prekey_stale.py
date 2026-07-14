"""Stale prekey bundle cleanup — PREKEY_STALE_DAYS from retention_policy."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from core.retention_policy import PREKEY_STALE_DAYS

logger = logging.getLogger("ssc")


async def purge_stale_prekeys(db) -> int:
    """Remove prekey bundles not updated within PREKEY_STALE_DAYS."""
    if PREKEY_STALE_DAYS <= 0:
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=PREKEY_STALE_DAYS)
    result = await db.prekeys.delete_many({"updated_at": {"$lt": cutoff}})
    removed = int(result.deleted_count or 0)
    if removed:
        logger.info("Purged %s stale prekey bundles (older than %sd)", removed, PREKEY_STALE_DAYS)
    return removed