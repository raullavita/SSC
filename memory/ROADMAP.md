# SSC Product Roadmap

**Version:** 1.0  
**Effective:** 2026-07-04  
**Principle:** One step at a time — each step is 100% complete before the next begins.

SSC cannot out-scale Signal/WhatsApp/Telegram on network size, but it can be **better on privacy, security, and clarity**. This roadmap prioritizes user-owned data, minimal server metadata, and honest E2EE — not feature parity for its own sake.

## Open PRs / overlap check

| PR # | Status | Topic | Roadmap overlap |
|------|--------|-------|-----------------|
| #7–#14 | Merged/closed | CI, ZAP, critical path | None — infra only |

**No open PRs** conflict with roadmap steps below. Future work is tracked as GitHub issues (see repo Issues).

---

## Step 1 — Panic wipe scope + conversations bug ✅ (this sprint)

**Goal:** Panic wipe clears **this user + this device** only. Other participants keep their chats.

| Area | Behavior |
|------|----------|
| Server | Delete account, devices, sessions, prekeys, push tokens, per-user meta |
| Server (shared) | Detach user from conversations/groups/calls — **do not** bulk-delete messages |
| Client | Clear `ssc_*` localStorage, sessionStorage, in-memory search index, Electron `ssc-signal/` store |
| Bugfix | `conversations.py` missing `_require_participant` on mark-read route |

**OSS:** N/A (in-house policy fix).

---

## Step 2 — Real libsignal group sender keys (issue #15) ✅

**Goal:** Replace XOR placeholder in `frontend/src/signal/groupSenderKeys.js` with real sender-key distribution.

| OSS | Use |
|-----|-----|
| [@signalapp/libsignal-client](https://www.npmjs.com/package/@signalapp/libsignal-client) | Already used in Electron; extend for group sender keys |
| [signalapp/libsignal](https://github.com/signalapp/libsignal) | Reference implementation (Rust core) |
| [signalapp/libsignal-protocol-javascript](https://github.com/signalapp/libsignal-protocol-javascript) | Legacy JS reference (deprecated but useful for API shape) |

**Deliverables:** `GroupSenderKeyStore`, server relay for sender-key distribution messages, remove XOR path in production.

**Shipped (2026-07-04):** `electron/groupSenderKeySession.js` (file-backed `SenderKeyStore`), IPC via `ssc-group-keys:*`, protocols `group_sender_key_v2` + `group_sender_key_dist_v1`, distribution posted to group conversation. Dev XOR isolated in `groupSenderKeysDev.js` for CRA tests only.

---

## Step 3 — TURN for calls (issue #17) ✅

**Goal:** Reliable group/1:1 calls behind NAT; SFU for large groups.

| OSS | Use |
|-----|-----|
| [coturn/coturn](https://github.com/coturn/coturn) | TURN/STUN server |
| [versatica/mediasoup](https://github.com/versatica/mediasoup) | Already scaffolded in `sfu-server/` |

**Deliverables:** TURN credentials API, `iceServers` in `useCall` / `useGroupCall`, deploy coturn alongside SFU.

**Shipped (2026-07-04):** `GET /api/calls/ice-servers`, `core/turn_policy.py`, `calls/iceServers.js`, wired in `useCall` + `sfuSession` + `useGroupCall`, coturn deploy via `scripts/deploy_turn_gce.ps1`.

---

## Step 4 — Strip dev crypto from production builds (issue #16) ✅

**Goal:** No `buildDevSignalEnvelope` / placeholder protocol in production clients.

| OSS | Use |
|-----|-----|
| `@signalapp/libsignal-client` | Required in Electron + Android native bridge |

**Deliverables:** Build-time flag, `InstalledClientGate` hard-fail without libsignal, remove `LEGACY_PLACEHOLDER_PROTOCOL` from prod API acceptance.

**Shipped (2026-07-04):** `REACT_APP_SSC_REQUIRE_LIBCRYPTO`, `cryptoPolicy.js`, strict `InstalledClientGate`, production API rejects placeholder/dev protocols and dev-envelope ciphertext.

---

## Step 5 — Android libsignal native bridge (issue #18) ✅

**Goal:** Wire Android WebView to real libsignal-android, not dev envelope.

| OSS | Use |
|-----|-----|
| [signalapp/libsignal](https://github.com/signalapp/libsignal) | `libsignal-android` 0.96.4 from Signal Maven |
| [signalapp/Signal-Android](https://github.com/signalapp/Signal-Android) | Integration patterns |

**Shipped (2026-07-04):** `SscNativeBridge` + `ssc_crypto_bridge.js` expose `window.sscCrypto` (Electron preload parity), file-backed stores under `filesDir/ssc-signal/`, group sender keys, Signal Maven repo + Kotlin 2.2.20, `cryptoPolicy.js` requires real `sscCrypto` on Android.

---

## Step 6 — Metadata hardening pass (issue #19) ✅

**Goal:** Audit every API response against `METADATA_MINIMIZATION_CHARTER.md`.

**Shipped (2026-07-05):** Auth omits `email`; WS fanout strips `participants`; devices omit `last_active`; recursive `scrub_payload`; sealed sender default-on; expanded `metadata_proof.py` + fanout tests; group conversation DTO fix on get/patch.

---

## Step 7 — Stories / polls / disappearing messages (issue #21) ✅

**Goal:** Implement charter schemas already in retention policy.

| OSS | Use |
|-----|-----|
| Existing SSC retention + smart policy | `backend/core/smart_policy.py` |

**Shipped (2026-07-05):** `stories` + `polls` API routes, `StoriesBar` + `PollBubble` UI, disappearing message expiry filter + live countdown, `step7_proof.py`.

---

## Step 8 — Release v0.2.0 (issue #20) ✅

**Goal:** Signed Electron + Android APK, changelog, production deploy checklist.

**Shipped (2026-07-05):** `CHANGELOG.md`, version 0.2.0 across clients/API, professional landing with OSS/AGPL compliance, `memory/RELEASE_v0.2.0_CHECKLIST.md`, `step8_proof.py`, updated `PLATFORM_RELEASE_CHARTER.md` (libsignal-android 0.96.4).

---

## Step 9 — Read receipts UI + fanout (issue #4) ✅

**Goal:** Wire privacy-opt-in read receipts end to end — default off.

**Shipped (2026-07-05):** `GET /api/conversations/{id}/reads`, WS fanout on `user:` + `conversation:` topics, `useReadReceipts` hydrate + live updates, ✓✓ on outgoing bubbles when peer opted in, `step9_proof.py`.

---

## Step 10 — Usernames + invite links (discovery) ✅

**Goal:** Let people find each other with `@username` and shareable invite links — no phone numbers, no app stores required.

**Shipped (2026-07-05):** `username_policy.py`, unique index, `PATCH /me/username`, `GET /by-username/{name}`, invite links `/add/{username}`, Settings QR + copy, `step10_proof.py`, `qrcode` OSS dep.

---

## Step 11 — Call reliability pass (issue #5) ✅

**Goal:** Reliable 1:1 WebRTC calls — ICE queue, hangup/missed flow, Android media permissions, tests.

**Shipped (2026-07-05):** ICE candidate queue + connection state monitoring, `POST /api/calls/{id}/end`, missed-call generic push, ring timeout, CallModal status labels, Android CAMERA/RECORD_AUDIO + WebChromeClient permission grant, `useCall` + `CallModal` tests, `step11_proof.py`.

---

## Step 12 — Message edit, delete, forward ✅

**Goal:** Edit within TTL, delete for me / for everyone, forward as new encrypted message.

**Shipped (2026-07-05):** `message_lifecycle_policy.py`, `PATCH/DELETE /api/messages/{id}`, `forwarded_from` on send, WS `message_edited` + `message_deleted`, `messageActions.js`, MessageBubble context actions, `step12_proof.py`.

---

## Step 13 — Safety numbers + trust UX ✅

**Goal:** Surface safety-number verification and trust state in chat UI.

**Shipped (2026-07-05):** `trustStore.js` (client-only `ssc_trust_v1`), `useTrustState` hook, real QR in `SafetyVerifyModal`, mark verified / reset, identity-change `TrustBanner`, verified ✓ / changed ⚠ badges in thread + sidebar, `trust_policy.py`, `step13_proof.py`.

---

## Step 14 — Per-chat privacy controls ✅

**Goal:** Per-conversation toggles for read receipts, typing, last seen, and disappearing defaults.

**Shipped (2026-07-05):** `conversation_privacy_policy.py`, `PATCH /conversations/{id}/privacy`, per-chat overrides in `conversation_meta`, effective privacy for read receipts/typing/last-seen, `ChatPrivacyPanel` + composer disappearing default, `step14_proof.py`.

---

## Step 15 — Multi-device polish (QR link) ✅

**Goal:** Streamlined QR device linking and multi-device sync UX.

**Shipped (2026-07-05):** QR link generation in Settings (`LinkedDevicesPanel`), `ssc://link-device` deep links, expiry countdown, copy link/app link, polished `/link-device` confirm flow with prekey registration, device list with “This device” badge, `step15_proof.py`.

---

## Step 16 — Encrypted backup/export

**Goal:** Client-side encrypted chat export and restore.

**Shipped (2026-07-05):** Passphrase-encrypted `.ssc-backup` export in Settings (`BackupPanel`), local trust/prefs/sender keys + search index snapshot, PBKDF2 + AES-GCM client crypto, restore with confirmation, `backup_policy.py`, `step16_proof.py`.

---

## Step 17 — Android shell improvements

**Goal:** Native Android UX polish beyond WebView shell.

**Shipped (2026-07-05):** Splash screen + SSC dark theme, `ssc://` and HTTPS deep links (`link-device`, `add/{username}`), pull-to-refresh, offline retry panel, WebView file chooser, `SscDeepLink.kt`, `android_shell_policy.py`, `step17_proof.py`.

---

## Step 18 — Release v0.3.0

**Goal:** First release with attached Electron + Android binaries after Steps 10–17.

---

## Community contribution

Steps 2–17 tracked on roadmap and GitHub issues. Pick one issue, comment, open a PR against `main`. Do **not** combine multiple steps in one PR.

*Machine-readable gates: `backend/scripts/run_engine*_gate.py`*