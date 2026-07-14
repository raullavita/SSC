"""MongoDB collection registry and TTL index bootstrap — Engine 1."""

from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from core.retention_policy import COLLECTIONS, DEFAULT_TTL_HOURS

logger = logging.getLogger("ssc")

# Every collection SSC may write to; must match retention_policy.COLLECTIONS keys.
LIFESPAN_COLLECTIONS: frozenset[str] = frozenset(COLLECTIONS.keys())


async def ensure_ttl_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create TTL indexes for collections that use expires_at (or configured field)."""
    for name in sorted(LIFESPAN_COLLECTIONS):
        policy = COLLECTIONS[name]
        if not policy.has_ttl_index or not policy.ttl_field:
            continue
        collection = db[name]
        index_name = f"ttl_{policy.ttl_field}"
        await collection.create_index(
            policy.ttl_field,
            expireAfterSeconds=0,
            name=index_name,
        )
    logger.info(
        "Retention TTL active — default_window=%sh per_user=True",
        DEFAULT_TTL_HOURS,
    )


async def ensure_username_index(db: AsyncIOMotorDatabase) -> None:
    """Unique sparse index for @username discovery — Step 10."""
    await db.users.create_index(
        "username",
        unique=True,
        sparse=True,
        name="uniq_username",
    )


async def bootstrap_database(db: AsyncIOMotorDatabase) -> None:
    """Startup hook: ensure TTL indexes exist."""
    from core.prekey_stale import purge_stale_prekeys  # noqa: PLC0415

    await ensure_ttl_indexes(db)
    await ensure_username_index(db)
    await purge_stale_prekeys(db)