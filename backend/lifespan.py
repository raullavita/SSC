"""Application startup/shutdown: indexes and DB health."""
from core.config import DB_NAME
from core.database import client, db
from core.logging_config import logger
from core.retention_db import backfill_retention_ttl_fields


def register_lifespan(app):
    @app.on_event("startup")
    async def startup():
        try:
            await db.command("ping")
            logger.info("MongoDB connection OK")
        except Exception as e:
            from core.logging_policy import safe_exception_label
            logger.warning(f"MongoDB ping failed: {safe_exception_label(e)}")

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
        await db.statuses.create_index("expires_at", expireAfterSeconds=0)
        await db.statuses.create_index([("author_id", 1), ("created_at", -1)])
        await db.friend_requests.create_index([("to_user_id", 1), ("status", 1)])
        await db.friend_requests.create_index([("from_user_id", 1), ("to_user_id", 1)], unique=True)
        await db.friend_requests.create_index("expires_at", expireAfterSeconds=0)
        await db.contacts.create_index([("user_id", 1), ("contact_id", 1)], unique=True)
        await db.contacts.create_index("contact_id")
        await db.invites.create_index("token", unique=True)
        await db.invites.create_index("created_at")
        await db.invites.create_index("expires_at", expireAfterSeconds=0)
        await backfill_retention_ttl_fields()
        logger.info(f"SSC backend ready — database: {DB_NAME}")

    @app.on_event("shutdown")
    async def shutdown():
        client.close()