"""
SSC Data Retention Policy — machine-readable mirror of memory/RETENTION_CHARTER.md.

Engine 1 Step 1.1: policy definition only.
Steps 1.2–1.7: enforcement code must align with this module.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional

from core.retention import DEFAULT_RETENTION_HOURS  # noqa: F401 — re-export for charter tests


class RetentionTier(str, Enum):
    ACCOUNT = "account"           # Tier A — until account deletion
    SOCIAL_GRAPH = "social_graph"  # Tier B — contacts / requests
    EPHEMERAL = "ephemeral"       # Tier C — ciphertext blobs
    CONVERSATION_META = "conversation_meta"  # Tier D — shells & reads
    SESSION = "session"           # Tier E
    DEVICE = "device"             # Tier F — push tokens


class EnforcementStatus(str, Enum):
    ENFORCED = "enforced"
    PARTIAL = "partial"
    GAP = "gap"
    NOT_USED = "not_used"


@dataclass(frozen=True)
class CollectionPolicy:
    name: str
    tier: RetentionTier
    max_lifetime: str
    ttl_field: Optional[str]
    enforcement: EnforcementStatus
    engine1_step: Optional[str]
    allowed_fields: str
    notes: str = ""


# Every Mongo collection touched by lifespan.py must appear here.
COLLECTIONS: Dict[str, CollectionPolicy] = {
    "users": CollectionPolicy(
        name="users",
        tier=RetentionTier.ACCOUNT,
        max_lifetime="until_account_deletion",
        ttl_field=None,
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="identity, password_hash, public_key, encrypted_private_key, pk_salt, preferences",
        notes="No plaintext messages. last_seen is metadata.",
    ),
    "contact_seals": CollectionPolicy(
        name="contact_seals",
        tier=RetentionTier.SOCIAL_GRAPH,
        max_lifetime="until_user_removes_or_panic",
        ttl_field=None,
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="seal, created_at",
        notes="Blind pair seal — no plaintext user ids (contact graph privacy).",
    ),
    "contact_rosters": CollectionPolicy(
        name="contact_rosters",
        tier=RetentionTier.SOCIAL_GRAPH,
        max_lifetime="until_user_removes_or_panic",
        ttl_field=None,
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="user_id, ciphertext, iv, version, updated_at",
        notes="Pepper-encrypted roster — staff-blind without CONTACT_GRAPH_PEPPER.",
    ),
    "contact_blocks": CollectionPolicy(
        name="contact_blocks",
        tier=RetentionTier.SOCIAL_GRAPH,
        max_lifetime="until_user_removes_or_panic",
        ttl_field=None,
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="seal, created_at",
        notes="Blind block seal.",
    ),
    "contact_mutes": CollectionPolicy(
        name="contact_mutes",
        tier=RetentionTier.SOCIAL_GRAPH,
        max_lifetime="until_user_removes_or_panic",
        ttl_field=None,
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="seal, created_at",
        notes="Blind mute seal.",
    ),
    "friend_requests": CollectionPolicy(
        name="friend_requests",
        tier=RetentionTier.SOCIAL_GRAPH,
        max_lifetime="pending_7d; resolved_purge_24h",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="request_id, from/to ids, usernames, status, created_at",
    ),
    "messages": CollectionPolicy(
        name="messages",
        tier=RetentionTier.EPHEMERAL,
        max_lifetime=f"{DEFAULT_RETENTION_HOURS}h",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="ciphertext, iv, encrypted_keys, ids, attachment refs",
        notes="E2E only — no plaintext body.",
    ),
    "files": CollectionPolicy(
        name="files",
        tier=RetentionTier.EPHEMERAL,
        max_lifetime=f"{DEFAULT_RETENTION_HOURS}h",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="file_id, owner_id, content_type, size, encrypted flag",
    ),
    "statuses": CollectionPolicy(
        name="statuses",
        tier=RetentionTier.EPHEMERAL,
        max_lifetime=f"{DEFAULT_RETENTION_HOURS}h",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="E2E ciphertext, encrypted_keys, viewers (user ids)",
    ),
    "calls": CollectionPolicy(
        name="calls",
        tier=RetentionTier.EPHEMERAL,
        max_lifetime=f"{DEFAULT_RETENTION_HOURS}h",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.NOT_USED,
        engine1_step=None,
        allowed_fields="call metadata if implemented",
        notes="TTL index exists; no application writes today.",
    ),
    "conversations": CollectionPolicy(
        name="conversations",
        tier=RetentionTier.CONVERSATION_META,
        max_lifetime=f"{DEFAULT_RETENTION_HOURS}h_after_last_activity",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="conversation_id, participants, is_group, admin_id, owner_id, member_roles, member_joined_at, group_topics, group_permissions, group_photo, group_description, created_at, last_activity_at, expires_at",
    ),
    "message_reads": CollectionPolicy(
        name="message_reads",
        tier=RetentionTier.CONVERSATION_META,
        max_lifetime=f"{DEFAULT_RETENTION_HOURS}h",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="conversation_id, user_id, last_read_message_id, last_read_at",
    ),
    "user_sessions": CollectionPolicy(
        name="user_sessions",
        tier=RetentionTier.SESSION,
        max_lifetime="jwt_ttl",
        ttl_field="expires_at",
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="user_id, session_token, expires_at",
    ),
    "push_subscriptions": CollectionPolicy(
        name="push_subscriptions",
        tier=RetentionTier.DEVICE,
        max_lifetime="until_unsubscribe",
        ttl_field=None,
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="user_id, endpoint, keys",
    ),
    "native_push_tokens": CollectionPolicy(
        name="native_push_tokens",
        tier=RetentionTier.DEVICE,
        max_lifetime="until_unregister",
        ttl_field=None,
        enforcement=EnforcementStatus.ENFORCED,
        engine1_step=None,
        allowed_fields="user_id, token, platform",
    ),
}

# GridFS buckets (not in lifespan indexes but used by files router)
GRIDFS_POLICY = CollectionPolicy(
    name="fs.files/fs.chunks",
    tier=RetentionTier.EPHEMERAL,
    max_lifetime=f"{DEFAULT_RETENTION_HOURS}h",
    ttl_field="expires_at",
    enforcement=EnforcementStatus.ENFORCED,
    engine1_step=None,
    allowed_fields="opaque E2E bytes",
)

# Mirror of core/egress_policy.EGRESS_CATALOG — keep ids in sync for audits.
THIRD_PARTY_EGRESS = [
    {
        "id": "translation",
        "service": "MyMemory / Google Translate",
        "trigger": "POST /api/translate",
        "data": "plaintext message text",
        "engine1_step": "1.2",
    },
    {
        "id": "google_oauth",
        "service": "Google OAuth",
        "trigger": "Google login",
        "data": "email, oauth tokens",
        "engine1_step": "1.6",
    },
    {
        "id": "fcm",
        "service": "Google FCM / Apple APNs (Firebase)",
        "trigger": "native push",
        "data": "device token, notification payload",
        "engine1_step": "1.6",
    },
    {
        "id": "web_push",
        "service": "Web Push (browser push services)",
        "trigger": "PWA push",
        "data": "push endpoint URL, notification payload",
        "engine1_step": "1.6",
    },
    {
        "id": "turn_stun",
        "service": "STUN/TURN (WebRTC)",
        "trigger": "WebRTC calls",
        "data": "IPs, call signaling metadata",
        "engine1_step": "1.6",
    },
    {
        "id": "mongo_remote",
        "service": "MongoDB Atlas / remote Mongo",
        "trigger": "all database reads/writes",
        "data": "all Tier A–F data when hosted remotely",
        "engine1_step": "1.6",
    },
    {
        "id": "turnstile",
        "service": "Cloudflare Turnstile",
        "trigger": "register/login captcha",
        "data": "captcha token, client IP",
        "engine1_step": "1.6",
    },
]

NEVER_LOG = [
    "ciphertext",
    "decrypted text",
    "encrypted_private_key",
    "password",
    "jwt",
    "totp_secret",
    "translation text",
    "file bytes",
]

ENGINE1_STEPS = [
    ("1.1", "Retention Charter", True),
    ("1.2", "Close plaintext leaks (translate)", True),
    ("1.3", "TTL on conversations, reads, friend_requests", True),
    ("1.4", "Conversation metadata minimization", True),
    ("1.5", "Logging hygiene", True),
    ("1.6", "Third-party dependency map in config", True),
    ("1.7", "Engine 1 test gate", True),
]


def collections_with_gaps() -> List[CollectionPolicy]:
    return [p for p in COLLECTIONS.values() if p.enforcement == EnforcementStatus.GAP]


def all_collection_names() -> List[str]:
    return sorted(COLLECTIONS.keys())