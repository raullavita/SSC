# SSC Signal Protocol Charter

**Version:** 1.0  
**Effective:** 2026-06-23  
**Engine:** 8 — Signal Protocol (X3DH + Double Ratchet)  
**Step:** 8.1 (policy only; enforcement in steps 8.2–8.8)

---

## 1. Purpose

Engines 1–5 minimized data, enforced E2E honesty, hardened sessions, and reduced metadata. Engine 8 closes **G9** (no Double Ratchet) and **G6** (WebRTC signaling cleartext) from the E2E Integrity Charter.

This charter defines:

- **Verified official** cryptographic libraries (no third-party npm crypto clones)
- Target protocol: **X3DH** (initial session) + **Double Ratchet** (ongoing 1:1 messaging)
- Server role: **public prekey relay only** — never sees message keys or plaintext
- Migration from today's RSA-OAEP + per-message AES envelope
- Capacitor/Android integration path
- AGPL license obligations when shipping libsignal

**Rule:** No Engine 8 enforcement code may use unaudited crypto forks. Only sources listed in §4.

**Prerequisites:** Engines 1–5 complete (gates passed 2026-06-23).

---

## 2. Vision alignment

| Principle | Engine 8 meaning |
|-----------|------------------|
| Super secure | Forward secrecy + break-in recovery comparable to Signal/WhatsApp class |
| Honest product | Dual-read period documented; legacy RSA messages labeled in UI |
| 24h recycle | Unchanged — ratchet state is client-side; server stores ciphertext blobs as today |
| Own metal | Deferred post-investors — protocol design is host-agnostic |
| Testers / Play beta | Engine 8 can ship incrementally; Google Play beta later |

---

## 3. Cryptographic baseline

### 3.1 Today (legacy — `crypto.js`)

| Component | Algorithm | Limitation |
|-----------|-----------|------------|
| Identity | RSA-OAEP 2048 | Long-term identity key; no ratchet |
| Message body | AES-256-GCM + ephemeral AES per message | Message-level symmetric FS only |
| Private key wrap | PBKDF2 200k + AES-GCM | Unchanged for account unlock |
| Groups | RSA wrap per recipient | No Sender Keys yet (out of Engine 8 v1 scope) |

### 3.2 Target (Signal Protocol)

| Component | Algorithm | Source |
|-----------|-----------|--------|
| Identity key | Curve25519 key pair | libsignal |
| Signed prekey + one-time prekeys | X25519 | libsignal |
| Initial session | **X3DH** | libsignal-protocol |
| Ongoing 1:1 messages | **Double Ratchet** (AES-256 + HMAC-SHA256) | libsignal-protocol |
| Safety number | Derived from identity keys (replace RSA fingerprint) | libsignal + SSC UI |

**Engine 8 v1 scope:** 1:1 direct messages and 1:1 attachments. **Group Sender Keys** deferred to Engine 8+ or separate engine.

---

## 4. Approved libraries (verified official sources)

Only these sources may be used for Signal Protocol implementation.

### 4.1 Primary — Signal Foundation (official)

| Artifact | Source | Verify before install |
|----------|--------|------------------------|
| **Source repo** | https://github.com/signalapp/libsignal | Org: `signalapp`; License: AGPL-3.0 |
| **npm (Node/Desktop tests)** | `@signalapp/libsignal-client` | Publisher: Signal; registry: https://www.npmjs.com/package/@signalapp/libsignal-client |
| **Android (Capacitor native)** | `org.signal:libsignal-android` | Maven: https://build-artifacts.signal.org/libraries/maven/ |
| **Android companion** | `org.signal:libsignal-client` | Same Maven repo (exclude desktop DLLs in APK) |

**Install rule:** Pin exact version in lockfile. Record version + SHA in `memory/SIGNAL_PROTOCOL_CHARTER.md` changelog when bumped.

### 4.2 Explicitly forbidden

| Source | Reason |
|--------|--------|
| Random npm `"signal"`, `"e2e"`, `"ratchet"` packages | Unaudited |
| `libsignal-protocol-javascript` (archived) | Superseded by `libsignal` |
| `@privacyresearch/libsignal-protocol-typescript` | Community port — not for production SSC |
| Copy-paste crypto from blogs / Stack Overflow | Unaudited |

### 4.3 SSC platform strategy

| Platform | Approved path |
|----------|---------------|
| **Android APK (Capacitor)** | Custom Capacitor plugin → `libsignal-android` AAR from Signal Maven |
| **Web / PWA** | ❌ **Not a product surface** — browser WASM retired (Engine 8.10); use Engine 10 desktop |
| **Windows / Mac desktop** | `@signalapp/libsignal-client` via Electron (Engine 10) |
| **Backend** | **No libsignal on server** — store public prekey bundles only |

### 4.4 License (AGPL-3.0)

libsignal is **AGPL-3.0**. The conveyed **Android APK** (Play Store, Firebase App Distribution) is licensed under AGPL-3.0 with corresponding source at `https://github.com/raullavita/SSC`. See **`memory/AGPL_COMPLIANCE.md`**, root `LICENSE`, `THIRD_PARTY_NOTICES.md`, and in-app Settings → Open source. Does **not** block development or private beta when source offer is maintained.

---

## 5. Server data model (new — public material only)

Server **may** store for each user:

| Field | Content | Secret? |
|-------|---------|---------|
| `identity_key_public` | Curve25519 public bytes (base64) | No |
| `signed_prekey` | Public + signature | No |
| `signed_prekey_id` | Integer | No |
| `one_time_prekeys` | List of `{id, public}` | No |
| `kyber_prekey_public` | Kyber-1024 public (PQXDH hybrid) | No |
| `kyber_prekey_id` | Integer | No |
| `kyber_prekey_signature` | Identity-signed Kyber key | No |
| `registration_id` | libsignal registration id | No |

Server **must never** store: private keys, chain keys, root keys, ratchet state, decrypted plaintext.

Message documents gain optional field:

| Field | Meaning |
|-------|---------|
| `protocol` | `"legacy_rsa"` (default) or `"signal_v1"` |
| `ciphertext` | Opaque — format depends on protocol |
| `encrypted_keys` | Legacy only; omitted for signal_v1 1:1 |

---

## 6. Migration strategy (no user lock-out)

1. **Dual-read:** Clients decrypt both `legacy_rsa` and `signal_v1` messages.
2. **Dual-write window:** New 1:1 chats use Signal when both peers have prekeys uploaded.
3. **Fallback:** If peer has no prekeys → legacy RSA envelope (logged in UI as "legacy encryption").
4. **Safety numbers:** Re-derived from identity keys when peer upgrades; re-verify prompt.
5. **No forced re-registration** — existing accounts upload prekeys on next login.

---

## 7. Gap closure

| ID | Gap | Engine 8 step |
|----|-----|---------------|
| G9 | No Signal Protocol / Double Ratchet | 8.4–8.5 |
| G6 | WebRTC signaling cleartext | 8.7 |

---

## 8. Engine 8 steps

| Step | Description | Status |
|------|-------------|--------|
| **8.1** | This charter + `backend/core/signal_policy.py` + proof | 🔄 |
| **8.2** | Safety numbers v3 (libsignal identity keys) + QR verify UI | ✅ |
| **8.3** | Prekey bundle API + client upload; pin official libsignal dep | ✅ |
| **8.4** | X3DH session establishment (1:1) | ✅ |
| **8.5** | Double Ratchet send/receive; `protocol=signal_v1` messages | ✅ |
| **8.6** | Dual-read legacy RSA; migration UX | ✅ |
| **8.7** | WebRTC signaling encrypted via ratchet session (G6) | ✅ |
| **8.8** | Engine 8 test gate + integration proof | ✅ |

---

## 9. Testing strategy (founder — locked)

| Mode | Use |
|------|-----|
| Unit tests | Mock libsignal store; no network |
| Integration | Two test users, prekey upload, round-trip ciphertext |
| Gate | `backend/scripts/run_engine8_gate.py` + `signal_proof.py` |
| Manual | Founder APK — 1:1 chat with second account |
| Mass testers | Deferred — Google Play closed beta later |

---

## 10. Engine 8.1 completion checklist

- [x] **8.1** Signal Protocol Charter (this document)
- [x] **8.1** Machine-readable policy (`backend/core/signal_policy.py`)
- [x] **8.1** Proof script (`backend/scripts/signal_proof.py`)
- [x] **8.2** Safety numbers v3 (`safetyNumber.js`, local QR, paste compare)
- [x] **8.3** Prekey API + `org.signal:libsignal-android:0.96.2` + Capacitor plugin
- [x] **8.4** X3DH session establishment (libsignal SessionBuilder + device store)
- [x] **8.5** Double Ratchet messages (`signal_v1`, SessionCipher)
- [x] **8.6** Legacy dual-read + migration UX (SIG/RSA badges, composer hints)
- [x] **8.7** WebRTC signaling E2E (1:1 signal_v1; group legacy)
- [x] **8.8** Engine 8 gate (`run_engine8_gate.py`, `test_engine8_integration.py`)

---

## Changelog

| Date | libsignal version pinned | Notes |
|------|--------------------------|-------|
| 2026-06-23 | (not installed yet) | Engine 8.1 charter only |
| 2026-06-23 | **0.96.2** | Engine 8.3 — npm `@signalapp/libsignal-client`, Maven `libsignal-android` |
| 2026-06-23 | **0.96.2** | Engine 8.4 — X3DH via SessionBuilder; Kyber prekeys in bundle (PQXDH hybrid) |
| 2026-06-23 | **0.96.2** | Engine 8.5 — Double Ratchet `signal_v1` text messages (G9 closed) |
| 2026-06-23 | **0.96.2** | Engine 8.6 — dual-read legacy_rsa + signal_v1; honest encryption labels |
| 2026-06-23 | **0.96.2** | Engine 8.7 — WebRTC 1:1 signaling via signal_v1 ratchet (G6 closed) |
| 2026-06-23 | **0.96.2** | Engine 8.8 — full gate + live integration proof; Engine 8 complete |
| 2026-06-29 | **0.96.4** | Q.55 — PQXDH hybrid formalized; libsignal bump; Kyber prekeys enforced |