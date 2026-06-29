# SSC Data Retention Charter

**Version:** 1.0  
**Effective:** 2026-06-23  
**Engine:** 1 — Minimum Data Existence  
**Step:** 1.1 (policy only; enforcement in steps 1.2–1.7)

---

## 1. Purpose

SSC exists so that **almost nothing useful survives** on the server or on a grabbed device after the recycle window — except what is strictly required to keep an account usable.

This charter defines:

- What the server **may** store
- How long each class of data **may** exist
- What must **never** be stored or logged
- What leaves your metal (third parties)
- Gaps between **today** and **target** (tracked per step)

**Rule:** No Engine 2 work until every Engine 1 step is implemented and tested against this document.

---

## 2. Vision alignment (founder intent)

| Principle | Meaning for retention |
|-----------|----------------------|
| Auto-recycle | Messages, files, stories, call metadata, and conversation shells expire on schedule |
| Account survives | `users` row + wrapped private key remain so login still works |
| Panic = grab phone | Wipes visible footprint fast; server purge async (Engine 3) |
| Own metal | MongoDB + Redis on **your** hardware; no Atlas/Firebase control plane in production |
| Super secure | Minimize **existence** of data, not just encrypt it |

---

## 3. Default recycle window

| Setting | Value | Notes |
|---------|-------|-------|
| `SSC_RETENTION_HOURS` | **24** (default) | Applies to all Tier C/D ephemeral data unless noted |
| Configurable later | 6 / 12 / 24 | Shorter = less forensic value; more server churn |

---

## 4. Data tiers

### Tier A — Account (persistent until user deletes account)

**Purpose:** Authentication, encryption identity, preferences.

| Store | Collection | Max lifetime | Allowed fields | Plaintext content |
|-------|------------|--------------|----------------|-------------------|
| MongoDB | `users` | Until account deletion | `user_id`, `email`, `username`, `password_hash`, `public_key`, `encrypted_private_key`, `pk_salt`, `language`, `avatar`, `auth_provider`, `google_sub`, `totp_enabled`, `totp_backup_hashes`, `created_at`, `last_seen` | **No** message bodies; `last_seen` is metadata |

**Never store on user row:** decrypted private key, TOTP secret in API responses, message text.

**Enforced (Engine 4):** `last_seen` write throttle, 7d TTL, peer coarsening — `core/last_seen.py`.

---

### Tier B — Social graph (persistent today; metadata risk)

**Purpose:** Who may message whom; mute/block; friend discovery.

| Store | Collection | Max lifetime (target) | Allowed fields | Risk |
|-------|------------|----------------------|----------------|------|
| MongoDB | `contact_seals` | **Persistent** (panic may keep — wife scenario) | `seal`, `created_at` | Blind pair edge (no plaintext user ids) |
| MongoDB | `contact_rosters` | **Persistent** | `user_id`, `ciphertext`, `iv`, `version` | Pepper-encrypted friend list |
| MongoDB | `broadcast_lists` | **Persistent** (panic may keep) | `list_id`, `owner_id`, `name`, `recipient_ids`, timestamps | Saved contact subsets for 1:1 fan-out sends (Q.30) |
| MongoDB | `contact_blocks` | **Persistent** | `seal`, `created_at` | Blind block edge |
| MongoDB | `contact_mutes` | **Persistent** | `seal`, `created_at` | Blind mute edge |
| MongoDB | `conversation_mutes` | **Until unmutes or expiry** | `seal`, `user_id`, `conversation_id`, `duration`, `muted_until`, timestamps | Per-chat notification mute (Q.44) |
| MongoDB | `signal_devices` | **Until unlink / account delete** | `user_id`, `device_id`, `device_name`, `platform`, timestamps | Linked device registry (Q.51) |
| MongoDB | `device_link_tokens` | **10m TTL** | `token`, `user_id`, `expires_at` | Ephemeral device link QR tokens (Q.51) |
| MongoDB | `friend_requests` | **Pending:** 7d TTL; **accepted/rejected:** purge 24h after resolution (step 1.3) | `request_id`, user ids, usernames, `status`, `created_at` | Request history |

**Charter decision (v1.1, contact graph privacy):** Social graph **remains** until user removes it — required for app function and panic UX. Stored as **blind seals + encrypted rosters** — see `CONTACT_GRAPH_PRIVACY_CHARTER.md`.

---

### Tier C — Ephemeral content (24h TTL — enforced today)

**Purpose:** E2E ciphertext blobs; server cannot read content without keys.

| Store | Collection | Max lifetime | Allowed fields | Enforced |
|-------|------------|--------------|----------------|----------|
| MongoDB | `messages` | 24h (`expires_at` TTL) | `ciphertext`, `iv`, `encrypted_keys`, ids, `attachment_*`, `plaintext_length` (length only) | ✅ TTL index |
| MongoDB | `files` | 24h metadata; GridFS blob deleted with record | `file_id`, `owner_id`, `content_type`, `size`, `encrypted` flag | ✅ TTL index |
| MongoDB GridFS | `fs.files` / `fs.chunks` | 24h (via file record + panic) | Opaque bytes (E2E) | ✅ |
| MongoDB | `statuses` | 24h | E2E `ciphertext`, `encrypted_keys`, `viewers` (user ids only) | ✅ TTL index |
| MongoDB | `calls` | 24h (index exists) | Call metadata if written | ⚠️ Index only; **no writes today** |

**Rule:** No plaintext message/story/file content in any Tier C field.

---

### Tier D — Conversation shell & activity (GAP — step 1.3)

**Purpose:** Routing threads; read state. **Highest forensic gap today.**

| Store | Collection | Today | Target (step 1.3) |
|-------|------------|-------|-------------------|
| MongoDB | `conversations` | **Forever** — participant ids, group name, `created_at` | **24h** from last activity OR delete when last message TTL expires |
| MongoDB | `message_reads` | **Forever** — who read what | **24h** or delete with conversation |

**Metadata in conversations today:** `participants`, `is_group`, `name` (group title may hint topic — keep short, no message preview stored on conv row).

**List endpoint note:** `GET /conversations` attaches `last_message` (ciphertext) — dies with message TTL but conv row remains.

---

### Tier E — Sessions & auth tickets

| Store | Collection / key | Max lifetime | Target |
|-------|------------------|--------------|--------|
| MongoDB | `user_sessions` | JWT TTL (~7d) + `expires_at` TTL | ✅; align with shorter session in Engine 5 |
| Redis | `ssc:revoked:*` | JWT remaining TTL | Required in prod (Engine 5) |
| Redis | `ssc:ws_ticket:*` | 60 seconds | ✅ |

---

### Tier F — Push & device endpoints

| Store | Collection | Max lifetime | Target |
|-------|------------|--------------|--------|
| MongoDB | `push_subscriptions` | Until unsubscribe/logout/panic | ✅ panic wipes |
| MongoDB | `native_push_tokens` | Until unregister/logout/panic | ✅ panic wipes |

**Push payload rule (Engine 4):** Generic title/body only (`SSC` / `New activity`) — `core/push_payload.py`.

---

## 5. Ephemeral — never persisted

| Data | Where it appears | Rule |
|------|------------------|------|
| Decrypted message text | `/api/translate` request body | **Must not be default** (step 1.2); target: disabled in prod mode |
| WebRTC SDP / ICE | WebSocket only | Not written to Mongo today ✅ |
| Typing indicators | WebSocket broadcast | Not stored ✅ |
| WS `read` events | WebSocket | `message_reads` persists — **fix in 1.3** |
| Private key (decrypted) | Client memory / sessionStorage | Client threat model (Engine 2) |

---

## 6. Third-party egress map

Data that **leaves your metal** when features are enabled:

| Service | Trigger | Data sent | Production on own metal |
|---------|---------|-----------|-------------------------|
| MyMemory / Google Translate | `POST /api/translate` | **Plaintext** message excerpts | **Disable** (`TRANSLATION_PROVIDER=none` or step 1.2) |
| Google OAuth | Login | Email, OAuth tokens | Optional; user choice |
| Google FCM | Native push | Device token, notification payload | Hard on Android; document tradeoff (Engine 6) |
| Web Push (VAPID) | PWA push | Endpoint URL, payload | Self-hosted sender; endpoint is metadata |
| STUN/TURN | WebRTC | IPs, call metadata | Self-host TURN on your metal |
| MongoDB Atlas | `MONGO_URL` | All Tier A–F if used | **Replace with local Mongo** (Engine 6) |

**Air-gapped mode (target):** Tier A + B on your Mongo; Tier C/D TTL enforced; translate off; FCM optional.

### Enforcement (Step 1.6)

| Control | Implementation |
|---------|----------------|
| `core/egress_policy.py` | Egress catalog, `SSC_AIR_GAPPED_MODE`, runtime gates |
| `GET /api/config` | `egress` map + `air_gapped_mode`; self-hosted ICE when air-gapped |
| `translation_access.py` | Translation blocked when air-gapped |
| `google_auth.py` / `native_push.py` / `push.py` | OAuth, FCM, web push gated |
| `core/auth.py` | Turnstile skipped when air-gapped |
| `security.py` | Startup air-gap validation + violation warnings |

---

## 7. Logging policy (step 1.5)

### Must NEVER appear in logs

- Message `ciphertext` or decrypted text
- `encrypted_private_key`, `pk_salt`, passwords, JWTs, TOTP secrets
- Translation request `text`
- File bytes

### Allowed at INFO

- `user_id`, `conversation_id`, `message_id` (opaque ids)
- HTTP method, path, status, duration
- Rate-limit and auth failure **counts** (not passwords)

### Enforcement (Step 1.5)

| Control | Implementation |
|---------|----------------|
| `core/logging_policy.py` | JWT/query redaction filter, `token_log_ref`, `format_client_ip` |
| `middleware.py` | Path-only logs; IP redacted when `ENV=production` |
| Exception logs | Type name only — no response bodies |

---

## 8. Client-side retention (Engine 3)

**Canonical policy:** `memory/CLIENT_FOOTPRINT_CHARTER.md` + `backend/core/client_footprint_policy.py`

Server retention (this charter) ends at the API boundary. Client footprint — panic wipe, memory, PWA cache — is **Engine 3**.

| Location | Content | Status |
|----------|---------|--------|
| `localStorage` | `ssc_token`, push tokens | Clear on panic ✅ |
| `sessionStorage` | ephemeral keys | Clear on panic ✅ |
| `localStorage` | `ssc_verified_v2_*` | Clear on panic — step 3.4 |
| In-memory React state | Decrypted messages | Wipe — step 3.2 |
| Service worker cache | PWA assets | Purge — step 3.3 |
| IndexedDB | Audit | Step 3.5 |

---

## 9. Gap summary (code audit 2026-06-23)

| ID | Gap | Severity | Engine 1 step |
|----|-----|----------|---------------|
| G1 | Auto-translate default ON → plaintext to server | **Critical** | 1.2 ✅ |
| G2 | `conversations` no TTL | **Critical** | 1.3 ✅ |
| G3 | `message_reads` no TTL | **High** | 1.3 ✅ |
| G5 | `friend_requests` persist after accept/reject | **Medium** | 1.3 ✅ |
| G6 | Translate third-party egress | **Critical** | 1.2 ✅ + 1.6 |
| G7 | Request logs include client IP | **Medium** | 1.5 ✅ |
| G8 | Invite token in logs | **Low** | 1.5 ✅ |
| G9 | `calls` collection unused | **Low** | Document only |
| G10 | `plaintext_length` on messages | **Low** | Accept (length only) |

---

## 10. Engine 1 completion checklist

- [x] **1.1** Retention Charter (this document + `backend/core/retention_policy.py`)
- [x] **1.2** Close plaintext leaks (translate default off, prod guard)
- [x] **1.3** TTL / purge on conversations, message_reads, friend_requests
- [x] **1.4** Conversation metadata minimization
- [x] **1.5** Logging hygiene
- [x] **1.6** Third-party dependency map in config
- [x] **1.7** Engine 1 test gate

### Enforcement (Step 1.7)

| Control | Implementation |
|---------|----------------|
| `scripts/run_engine1_gate.py` | Unit tests + integration + retention proof orchestrator |
| `scripts/retention_proof.py` | Mongo TTL index / `expires_at` audit (Charter §11) |
| `core/retention_proof.py` | Shared proof logic for scripts and tests |
| `tests/test_engine1_integration.py` | Live-server Engine 1 guarantees |
| `tests/test_engine1_gate.py` | Manifest + sign-off checklist |

**Run gate:**
```powershell
cd backend
.\venv\Scripts\python.exe scripts\run_engine1_gate.py
```

---

## 11. Sign-off

When step 1.7 is complete, an operator with MongoDB access **24 hours after last activity** should find:

- ✅ `users` account row (+ wrapped key)
- ✅ `contact_seals` / `contact_rosters` (if not panic-wiped)
- ✅ Active `user_sessions` / push tokens for logged-in devices
- ❌ No messages, files, statuses, conversations, reads, or invite tokens

---

*Canonical copy: `SSC-main/memory/RETENTION_CHARTER.md`*  
*Desktop copy: `Desktop/SSC-RETENTION-CHARTER.md`*  
*Machine-readable: `SSC-main/backend/core/retention_policy.py`*