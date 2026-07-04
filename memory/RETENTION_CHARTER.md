# SSC Data Retention Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 1 — Minimum Data Existence

## Purpose

Document every server-side data store, its purpose, and its maximum lifetime. The machine-readable policy lives in `backend/core/retention_policy.py`.

## Collections (Phase 0 stub — Engine 1 will complete)

| Collection | Purpose | Default TTL |
|------------|---------|-------------|
| `users` | Account identity | Until panic wipe / account delete |
| `devices` | Linked device registry | Until panic wipe |
| `prekeys` | Public prekey bundles (no private keys) | Rotated; stale bundles TTL 7d |
| `messages` | Encrypted ciphertext relay | 24h |
| `conversations` | Thread metadata | Until panic wipe |
| `conversation_meta` | Mute/pin state | Until panic wipe |
| `conversation_mutes` | Per-conversation mute flags | Until panic wipe |
| `sessions` | Auth session hashes | Session TTL (see SESSION_HARDENING_CHARTER) |
| `push_tokens` | FCM device tokens | Until logout / panic wipe |

*Engine 1 gate will require every collection in `lifespan.py` to appear here and in `retention_policy.py`.*