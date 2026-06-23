# SSC E2E Integrity Charter

**Version:** 1.0  
**Effective:** 2026-06-23  
**Engine:** 2 — E2E Integrity  
**Step:** 2.1 (policy only; enforcement in steps 2.2–2.7)

---

## 1. Purpose

Engine 1 ensured **minimum data existence** on the server. Engine 2 ensures **cryptographic honesty**: what SSC claims is E2E encrypted actually is — on the wire, in APIs, in client storage, and in operator logs.

This charter defines:

- What is **truly E2E** today
- What is **server-mediated** (not E2E) and must be disclosed
- Client-side key material rules
- Gaps between **marketing/PRD** and **code reality**
- Enforcement steps 2.2–2.7

**Rule:** No Engine 3 work until every Engine 2 step is implemented and tested against this document.  
**Next:** Client grab-phone footprint → `memory/CLIENT_FOOTPRINT_CHARTER.md` (Engine 3).

**Prerequisite:** Engine 1 complete (retention charter + gate passed).

---

## 2. Vision alignment

| Principle | Meaning for E2E integrity |
|-----------|---------------------------|
| Super secure | Server cannot read message bodies, attachments, or statuses when E2E path is used |
| Grab-phone threat | Decrypted private key must not survive refresh / low-effort forensic read |
| Honest product | No feature marketed as E2E unless ciphertext-only on server |
| 24h recycle | Complements Engine 1 — even if ciphertext leaks metadata, content expires |

---

## 3. Cryptographic baseline (current implementation)

| Component | Algorithm | Where |
|-----------|-----------|--------|
| Identity keys | RSA-OAEP 2048 (SHA-256) | Client generates; server stores `public_key` + password-wrapped `encrypted_private_key` |
| Message body | AES-256-GCM per message; RSA-wrapped AES key per recipient | `frontend/src/lib/crypto.js` |
| Private key wrap | PBKDF2-SHA256 (200k iter) + AES-GCM | Registration / unlock |
| Attachments | Same as messages when `encrypted=true` + `attachment_iv` + `attachment_encrypted_keys` | `ChatHome.jsx` upload path |
| Statuses | Same envelope as messages | `Stories.jsx` |

**Not implemented:** Signal Protocol (X3DH + Double Ratchet). Per-message ephemeral AES provides **message-level** symmetric forward secrecy only — not full Signal-grade ratcheting (Engine 8).

---

## 4. E2E surfaces — target state

### 4.1 Messages — E2E ✅ (enforced)

| Path | Server sees | Client decrypts |
|------|-------------|-----------------|
| `POST /api/messages` | `ciphertext`, `iv`, per-user `encrypted_keys` | ✅ |
| `GET .../messages` | Same; API strips other users' keys (Engine 1.4) | ✅ |
| WebSocket `message` event | Ciphertext relay only | ✅ |

**Server must never:** store or log decrypted text.

---

### 4.2 Files / attachments — E2E ✅ (enforced)

| Path | E2E when | Status |
|------|----------|--------|
| Upload with `encrypted=true` | GridFS stores opaque bytes | ✅ |
| Upload without `encrypted` | Rejected `400` | ✅ Engine 2.5 |
| Download encrypted file | `GET /api/files/{id}` + `Authorization: Bearer` | ✅ Engine 2.3 |
| Download legacy plaintext file | Rejected `410` | ✅ Engine 2.5 |

**Enforced (2.5):** E2E-only upload; legacy plaintext download blocked server-side; client shows placeholder for pre-2.5 attachments without E2E keys.  
**Enforced (2.3):** `?auth=` query rejected/ignored; client uses `frontend/src/lib/files.js` blob fetch.

---

### 4.3 Statuses / stories — E2E ✅

Same envelope as messages. `GET /statuses` projects keys to viewer only.

---

### 4.4 Translation — NOT E2E ❌ (Engine 1.2 gated)

When `TRANSLATION_ENABLED=true`, client sends **plaintext** to `POST /api/translate`. Disabled by default; documented in egress map.

---

### 4.5 WebRTC calls — NOT E2E ❌ (Engine 8)

SDP and ICE candidates relayed in cleartext over WebSocket. Peers connect P2P for media, but **signaling is visible to server**. Documented; not fixed in Engine 2.

---

### 4.6 Push notifications — metadata only ⚠️

Payloads use generic text ("New encrypted message") — no ciphertext. Device tokens and endpoints are metadata (Engine 1 egress map).

---

## 5. Key material — client threat model

### 5.1 At rest on server (Tier A — allowed)

| Field | Protection |
|-------|------------|
| `encrypted_private_key` | PBKDF2 + AES-GCM with user password |
| `public_key` | Public |

Server never receives decrypted private key.

### 5.2 At rest on client (grab-phone)

| Location | Content | Risk | Engine 2 step |
|----------|---------|------|-----------------|
| ~~`sessionStorage.ssc_pk_jwk`~~ | ~~Decrypted private key JWK~~ | **Removed 2.2** ✅ | — |
| ~~`sessionStorage.ssc_pk_unlocked`~~ | ~~Unlock flag~~ | **Removed 2.2** ✅ | — |
| `localStorage.ssc_token` | JWT | High — session hijack | Engine 5 |
| ~~`localStorage.ssc_verified_*`~~ | ~~Trust flag only~~ | **Removed 2.6** ✅ | — |
| `localStorage.ssc_verified_v2_*` | Safety number + key fingerprints | Low | **2.6** ✅ |
| React state `privateKey` | Decrypted key in memory | Expected during session | Cleared on logout/panic |

**Enforced (2.2):** Private key lives in memory only after unlock; vault re-prompt on refresh. Legacy `ssc_pk_*` session keys purged on startup via `frontend/src/lib/vault.js`.

---

## 6. API integrity rules

### Server must NEVER return

- Decrypted message text
- Another user's `encrypted_keys` entry (viewer projection only — Engine 1.4 ✅)
- `totp_secret` / `password_hash`
- Raw private key JWK
- `plaintext_length` or `sender_username` on messages/statuses (**G5** — removed in 2.4 ✅)

### Server MAY return (metadata)

- `public_key` (required for E2E)
- `encrypted_private_key` + `pk_salt` to **authenticated owner only** via `/auth/me`

---

## 7. Transport integrity

| Channel | Secret in URL? | Status | Step |
|---------|----------------|--------|------|
| WebSocket | Ticket in query (60s TTL) | Acceptable — not JWT | ✅ ws_tickets |
| File download | `Authorization: Bearer` only | ✅ | 2.3 |
| REST API | `Authorization: Bearer` | ✅ | — |

**Uvicorn access logs** may still record WS ticket query strings — mitigated by short TTL; full log hygiene is Engine 1.5.

---

## 8. Verification & trust

| Feature | Reality | Gap |
|---------|---------|-----|
| Safety number modal | SHA-256 fingerprint of both public keys | ✅ Display correct |
| "Verified" badge | `ssc_verified_v2_{user_id}` JSON bound to safety number + fingerprints | ✅ Engine 2.6 |

---

## 9. Gap summary (code audit 2026-06-23)

| ID | Gap | Severity | Engine 2 step |
|----|-----|----------|---------------|
| G1 | Decrypted private key in `sessionStorage` | **Critical** | 2.2 ✅ |
| G2 | Private key restored on refresh without re-entering password | **High** | 2.2 ✅ |
| G3 | JWT in file download URL (`?auth=`) | **High** | 2.3 ✅ |
| G4 | Plaintext file upload still accepted | **Medium** | 2.5 ✅ |
| G5 | `plaintext_length` sent to server | **Low** | 2.4 ✅ |
| G6 | WebRTC signaling cleartext on server | **High** | Engine 8 (document only) |
| G7 | Verified badge is localStorage flag | **Medium** | 2.6 ✅ |
| G8 | Legacy attachment download without E2E keys | **Medium** | 2.5 ✅ |
| G9 | No Signal Protocol / ratchet | **High** | Engine 8 (document only) |
| G10 | Google OAuth `id_token` verified server-side | ✅ | N/A |

---

## 10. Engine 2 completion checklist

- [x] **2.1** E2E Integrity Charter (this document + `backend/core/e2e_policy.py`)
- [x] **2.2** Private key client storage hardening

### Enforcement (Step 2.2)

| Control | Implementation |
|---------|----------------|
| `frontend/src/lib/vault.js` | Policy + legacy `ssc_pk_*` purge |
| `frontend/src/context/AuthContext.jsx` | Memory-only `privateKey`; no JWK export to storage |
| `frontend/src/pages/ChatHome.jsx` | Vault unlock prompt when key not in memory |
- [x] **2.3** Remove JWT from file download URLs

### Enforcement (Step 2.3)

| Control | Implementation |
|---------|----------------|
| `backend/routers/files.py` | `Depends(get_current_user)` — no `?auth=` query |
| `frontend/src/lib/files.js` | `fetchFileBlob` / `fetchFileBytes` via axios Authorization |
| `frontend/src/lib/api.js` | Removed `fileUrl()` |
| `frontend/src/components/Message.jsx` | E2E attachments decrypt client-side |
- [x] **2.4** API response integrity audit (`plaintext_length`, key projection)

### Enforcement (Step 2.4)

| Control | Implementation |
|---------|----------------|
| `backend/core/api_integrity.py` | `FORBIDDEN_RESPONSE_FIELDS`, viewer projection, storage sanitize |
| `backend/routers/messages.py` | No `plaintext_length`/`sender_username` store or broadcast |
| `backend/routers/statuses.py` | `project_status_for_viewer` on create/list |
| `backend/core/realtime.py` | Per-recipient WS `message` projection |
| `frontend/src/pages/ChatHome.jsx` | No `plaintext_length` in POST body |
| `frontend/src/components/Stories.jsx` | No `plaintext_length` in POST body |
- [x] **2.5** Deprecate plaintext file upload path

### Enforcement (Step 2.5)

| Control | Implementation |
|---------|----------------|
| `backend/core/file_integrity.py` | Reject plaintext upload; block legacy download |
| `backend/routers/files.py` | `require_encrypted_upload` + `require_encrypted_file_record` |
| `frontend/src/pages/ChatHome.jsx` | `uploadEncryptedAttachment` only (`encrypted=true`) |
| `frontend/src/components/Message.jsx` | `LegacyAttachmentPlaceholder` — no plaintext fetch |
- [x] **2.6** Verification handshake hardening

### Enforcement (Step 2.6)

| Control | Implementation |
|---------|----------------|
| `frontend/src/lib/verification.js` | v2 record: safety number + peer/my fingerprints |
| `frontend/src/components/VerifyHandshakeModal.jsx` | Mark/clear via crypto-bound storage |
| `frontend/src/pages/ChatHome.jsx` | VERIFY button + badge when fingerprints match |
| `frontend/src/context/AuthContext.jsx` | Purge legacy `ssc_verified_*=1` on startup |
| `backend/core/verification_policy.py` | Machine-readable policy mirror |
- [x] **2.7** Engine 2 test gate

### Enforcement (Step 2.7)

| Control | Implementation |
|---------|----------------|
| `scripts/run_engine2_gate.py` | Unit tests + integration + integrity proof orchestrator |
| `scripts/e2e_integrity_proof.py` | Policy/gap/artifact verification CLI |
| `backend/core/e2e_integrity_proof.py` | Proof helpers + module manifest |
| `backend/tests/test_engine2_gate.py` | Gate manifest sign-off tests |
| `backend/tests/test_engine2_integration.py` | Live-server E2E integrity checks |

```powershell
cd backend
.\venv\Scripts\python.exe scripts\run_engine2_gate.py
```

---

## 11. Sign-off

When step 2.7 is complete, an attacker with **server access** should be unable to:

- ❌ Read message bodies, E2E files, or statuses for active conversations
- ❌ Obtain decrypted private keys from API responses or logs
- ❌ Replay JWTs from file URL query strings (JWT not in URLs)

An attacker with **unlocked client access** should still be able to read messages (inherent to UX) — but **not** after refresh without password re-entry (step 2.2).

---

*Canonical copy: `SSC-main/memory/E2E_INTEGRITY_CHARTER.md`*  
*Machine-readable: `SSC-main/backend/core/e2e_policy.py`*  
*Depends on: `SSC-main/memory/RETENTION_CHARTER.md` (Engine 1)*