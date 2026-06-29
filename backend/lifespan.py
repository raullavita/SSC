"""Application startup/shutdown: indexes and DB health."""
import asyncio
from contextlib import asynccontextmanager

from core.config import DB_NAME
from core.database import client, db
from core.logging_config import logger
from core.retention_db import backfill_retention_ttl_fields


async def _ensure_indexes() -> None:
    await db.command("ping")
    logger.info("MongoDB connection OK")

    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.messages.create_index("expires_at", expireAfterSeconds=0)
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.files.create_index("expires_at", expireAfterSeconds=0)
    await db.calls.create_index("expires_at", expireAfterSeconds=0)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.conversations.create_index([("participants", 1)])
    await db.conversations.create_index("expires_at", expireAfterSeconds=0)
    await db.push_subscriptions.create_index([("user_id", 1)])
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.native_push_tokens.create_index("token", unique=True)
    await db.native_push_tokens.create_index([("user_id", 1), ("platform", 1)])
    await db.message_reads.create_index([("conversation_id", 1), ("user_id", 1)], unique=True)
    await db.message_reads.create_index("expires_at", expireAfterSeconds=0)
    await db.message_reactions.create_index([("conversation_id", 1), ("message_id", 1)])
    await db.message_reactions.create_index([("message_id", 1), ("user_id", 1)], unique=True)
    await db.message_reactions.create_index("expires_at", expireAfterSeconds=0)
    await db.message_poll_votes.create_index([("conversation_id", 1), ("message_id", 1)])
    await db.message_poll_votes.create_index([("message_id", 1), ("user_id", 1)], unique=True)
    await db.message_poll_votes.create_index("expires_at", expireAfterSeconds=0)
    await db.conversation_pins.create_index([("user_id", 1), ("conversation_id", 1)], unique=True)
    await db.conversation_pins.create_index([("user_id", 1), ("pinned_at", -1)])
    await db.conversation_pins.create_index("conversation_id")
    await db.conversation_archives.create_index([("user_id", 1), ("conversation_id", 1)], unique=True)
    await db.conversation_archives.create_index([("user_id", 1), ("archived_at", -1)])
    await db.conversation_archives.create_index("conversation_id")
    await db.statuses.create_index("expires_at", expireAfterSeconds=0)
    await db.statuses.create_index([("author_id", 1), ("created_at", -1)])
    await db.friend_requests.create_index([("to_user_id", 1), ("status", 1)])
    await db.friend_requests.create_index([("from_user_id", 1), ("to_user_id", 1)], unique=True)
    await db.friend_requests.create_index("expires_at", expireAfterSeconds=0)
    await db.contact_seals.create_index("seal", unique=True)
    await db.contact_blocks.create_index("seal", unique=True)
    await db.contact_mutes.create_index("seal", unique=True)
    await db.contact_rosters.create_index("user_id", unique=True)
    await db.broadcast_lists.create_index("list_id", unique=True)
    await db.broadcast_lists.create_index([("owner_id", 1), ("updated_at", -1)])

    from core.contact_graph import migrate_legacy_contacts

    migrated = await migrate_legacy_contacts()
    if migrated:
        logger.info(f"contact graph migration: {migrated} mutual pairs from legacy contacts")
    await db.signal_prekey_bundles.create_index("user_id", unique=True)
    await db.passkey_credentials.create_index("credential_id", unique=True)
    await db.passkey_credentials.create_index([("user_id", 1), ("created_at", 1)])
    await backfill_retention_ttl_fields()
    logger.info(f"SSC backend ready — database: {DB_NAME}")


async def _bootstrap_db_with_retry() -> None:
    delay = 5
    max_delay = 120
    while True:
        try:
            await _ensure_indexes()
            return
        except asyncio.CancelledError:
            raise
        except Exception as e:
            from core.logging_policy import safe_exception_label

            logger.warning(
                f"MongoDB bootstrap failed ({safe_exception_label(e)}); "
                f"retrying in {delay}s"
            )
            await asyncio.sleep(delay)
            delay = min(delay * 2, max_delay)


@asynccontextmanager
async def lifespan(app):
    from core.retention_janitor import start_retention_janitor, stop_retention_janitor
    from core.realtime import manager
    from core.ws_pubsub import start_ws_pubsub_listener, stop_ws_pubsub_listener

    await start_ws_pubsub_listener(manager.deliver_local)
    await start_retention_janitor()
    task = asyncio.create_task(_bootstrap_db_with_retry())
    try:
        yield
    finally:
        await stop_retention_janitor()
        await stop_ws_pubsub_listener()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        client.close()


def register_lifespan(app):
    """Backward-compatible no-op; use FastAPI(lifespan=lifespan) in server.py."""
    return None