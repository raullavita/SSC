# SSC Data Retention Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 1 — Minimum Data Existence

## Purpose

Document every server-side MongoDB collection, its purpose, and maximum lifetime. The machine-readable policy is `backend/core/retention_policy.py`. Startup TTL indexes are applied by `backend/core/lifespan.py`.

## Default windows

| Window | Applies to |
|--------|------------|
| **24h TTL** (`expires_at`) | Ephemeral relay data — messages, files, calls, stories, polls, reads, reactions |
| **Session TTL** (`expires_at`) | `sessions`, `refresh_tokens` (7 days until Engine 5 refines) |
| **Until panic wipe** | Identity, devices, prekeys, mutes, groups, push tokens, recovery keys |

## Panic wipe

`POST /api/panic/wipe` deletes **user-scoped** server data for the authenticated account and revokes all sessions. It does **not** bulk-delete shared chat relay — other participants keep their messages until TTL expiry.

| Scope | Collections / behavior |
|-------|------------------------|
| **User delete** | `users`, `devices`, `prekeys`, `sessions`, `push_tokens`, per-user meta, etc. |
| **Shared detach** | `conversations`, `groups`, `call_sessions` — remove user from participants/members; dissolve only if empty |
| **Skip (TTL only)** | `messages`, `polls` — shared ciphertext; wiping one user must not erase others' chats |

Client panic wipe also clears local `ssc_*` storage, search indexes, and Electron `ssc-signal/` crypto files on the device.

## Collections

| Collection | Purpose | Retention |
|------------|---------|-----------|
| `users` | Account identity and profile | Until panic wipe |
| `devices` | Linked device registry | Until panic wipe |
| `device_link_tokens` | Short-lived multi-device link tokens | 10m `expires_at` TTL |
| `prekeys` | Public prekey bundles (no private keys) | Until panic wipe |
| `messages` | Encrypted ciphertext relay | 24h `expires_at` (panic wipe skips — shared relay) |
| `files` | Encrypted attachment metadata | 24h `expires_at` + panic wipe |
| `conversations` | Thread metadata and participants | 24h `expires_at` + panic detach (not bulk delete) |
| `conversation_meta` | Pin/archive state per user | Until panic wipe |
| `conversation_mutes` | Per-conversation mute flags | Until panic wipe |
| `groups` | Group chat metadata | Until panic wipe |
| `group_members` | Group membership rows | Until panic wipe |
| `broadcast_lists` | Broadcast list definitions | Until panic wipe |
| `sessions` | Auth session hashes | Session TTL + panic wipe |
| `refresh_tokens` | Rotating refresh tokens | Session TTL + panic wipe |
| `push_tokens` | FCM device push tokens | Until panic wipe |
| `stories` | Encrypted status/stories relay | 24h `expires_at` + panic wipe |
| `polls` | Poll message definitions | 24h `expires_at` (panic wipe skips — shared relay) |
| `message_poll_votes` | Individual poll votes | 24h `expires_at` + panic wipe |
| `message_reads` | Read receipt pointers | 24h `expires_at` + panic wipe |
| `message_reactions` | Message reaction rows | 24h `expires_at` + panic wipe |
| `call_sessions` | WebRTC call session metadata | 24h `expires_at` + panic wipe |
| `friend_requests` | Pending contact requests | 24h `expires_at` + panic wipe |
| `message_retries` | Sesame decrypt retry counters | 7d `expires_at` TTL + panic wipe |
| `user_blocks` | User block relationships | Until panic wipe |
| `abuse_reports` | Abuse report submissions | 24h `expires_at` TTL + panic wipe |
| `abuse_flags` | Temporary abuse enforcement flags | 24h `expires_at` TTL + panic wipe |
| `beta_feedback` | In-app beta feedback | Until panic wipe |
| `site_feedback` | Public website reviews & feedback | Retained (not user-linked) |
| `recovery_keys` | Account recovery key hashes | Until panic wipe |

## Gate

Engine 1 is complete when `backend/scripts/run_engine1_gate.py` passes, including unit tests and **step 1.7** `retention_proof.py` against live Mongo.

*Machine-readable: `SSC/backend/core/retention_policy.py`*