"""Machine-readable data retention policy — Engine 1 source of truth."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

RetentionMode = Literal["until_panic", "ttl_expires_at", "session_ttl"]
PanicScope = Literal["user_delete", "shared_detach", "skip_shared"]

DEFAULT_TTL_HOURS = 24
SESSION_TTL_HOURS = 24 * 7
PREKEY_STALE_DAYS = 7


@dataclass(frozen=True)
class CollectionPolicy:
    name: str
    purpose: str
    mode: RetentionMode
    ttl_field: str | None = None
    panic_field: str | None = None
    panic_match: Literal["eq", "contains", "object_id"] = "eq"
    panic_scope: PanicScope = "user_delete"

    @property
    def has_ttl_index(self) -> bool:
        return self.mode in ("ttl_expires_at", "session_ttl") and self.ttl_field is not None


def default_expires_at(hours: int = DEFAULT_TTL_HOURS) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def session_expires_at(hours: int = SESSION_TTL_HOURS) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)


COLLECTIONS: dict[str, CollectionPolicy] = {
    "users": CollectionPolicy(
        name="users",
        purpose="Account identity and profile",
        mode="until_panic",
        panic_field="_id",
        panic_match="object_id",
    ),
    "devices": CollectionPolicy(
        name="devices",
        purpose="Linked device registry (multi-device)",
        mode="until_panic",
        panic_field="user_id",
    ),
    "device_link_tokens": CollectionPolicy(
        name="device_link_tokens",
        purpose="Short-lived multi-device link tokens",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="user_id",
    ),
    "prekeys": CollectionPolicy(
        name="prekeys",
        purpose="Public prekey bundles (no private keys)",
        mode="until_panic",
        panic_field="user_id",
    ),
    "messages": CollectionPolicy(
        name="messages",
        purpose="Encrypted ciphertext relay",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="sender_id",
        panic_scope="skip_shared",
    ),
    "files": CollectionPolicy(
        name="files",
        purpose="Encrypted attachment metadata",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="owner_id",
    ),
    "conversations": CollectionPolicy(
        name="conversations",
        purpose="Thread metadata and participants",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="participants",
        panic_match="contains",
        panic_scope="shared_detach",
    ),
    "conversation_meta": CollectionPolicy(
        name="conversation_meta",
        purpose="Pin/archive state per user",
        mode="until_panic",
        panic_field="user_id",
    ),
    "conversation_mutes": CollectionPolicy(
        name="conversation_mutes",
        purpose="Per-conversation mute flags",
        mode="until_panic",
        panic_field="user_id",
    ),
    "groups": CollectionPolicy(
        name="groups",
        purpose="Group chat metadata",
        mode="until_panic",
        panic_field="owner_id",
        panic_scope="shared_detach",
    ),
    "group_members": CollectionPolicy(
        name="group_members",
        purpose="Group membership rows",
        mode="until_panic",
        panic_field="user_id",
    ),
    "broadcast_lists": CollectionPolicy(
        name="broadcast_lists",
        purpose="Broadcast list definitions",
        mode="until_panic",
        panic_field="user_id",
    ),
    "sessions": CollectionPolicy(
        name="sessions",
        purpose="Auth session hashes",
        mode="session_ttl",
        ttl_field="expires_at",
        panic_field="user_id",
    ),
    "refresh_tokens": CollectionPolicy(
        name="refresh_tokens",
        purpose="Rotating refresh tokens",
        mode="session_ttl",
        ttl_field="expires_at",
        panic_field="user_id",
    ),
    "push_tokens": CollectionPolicy(
        name="push_tokens",
        purpose="FCM device push tokens",
        mode="until_panic",
        panic_field="user_id",
    ),
    "stories": CollectionPolicy(
        name="stories",
        purpose="Encrypted status/stories relay",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="user_id",
    ),
    "polls": CollectionPolicy(
        name="polls",
        purpose="Poll message definitions",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="creator_id",
        panic_scope="skip_shared",
    ),
    "message_poll_votes": CollectionPolicy(
        name="message_poll_votes",
        purpose="Individual poll votes",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="user_id",
    ),
    "message_reads": CollectionPolicy(
        name="message_reads",
        purpose="Read receipt pointers",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="user_id",
    ),
    "message_reactions": CollectionPolicy(
        name="message_reactions",
        purpose="Message reaction rows",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="user_id",
    ),
    "call_sessions": CollectionPolicy(
        name="call_sessions",
        purpose="WebRTC call session metadata",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="participants",
        panic_match="contains",
        panic_scope="shared_detach",
    ),
    "friend_requests": CollectionPolicy(
        name="friend_requests",
        purpose="Pending contact requests",
        mode="ttl_expires_at",
        ttl_field="expires_at",
        panic_field="from_user_id",
    ),
    "beta_feedback": CollectionPolicy(
        name="beta_feedback",
        purpose="In-app beta feedback submissions",
        mode="until_panic",
        panic_field="user_id",
    ),
    "site_feedback": CollectionPolicy(
        name="site_feedback",
        purpose="Public website reviews and feedback",
        mode="until_panic",
        panic_field="_id",
        panic_scope="skip_shared",
    ),
    "recovery_keys": CollectionPolicy(
        name="recovery_keys",
        purpose="Account recovery key hashes",
        mode="until_panic",
        panic_field="user_id",
    ),
}


def all_collection_names() -> list[str]:
    return sorted(COLLECTIONS.keys())


def ttl_collection_names() -> list[str]:
    return sorted(name for name, p in COLLECTIONS.items() if p.has_ttl_index)


def engine1_complete() -> bool:
    return bool(COLLECTIONS) and len(all_collection_names()) >= 18