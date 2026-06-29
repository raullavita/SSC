# SSC Security Model

**Version:** 1.1 · **Updated:** 2026-06-24
**Audience:** Founder, testers, investors  
**Companion:** `memory/SSC-ROADMAP.md`

---

## 1. What SSC protects

| Asset | Protection |
|-------|------------|
| Message bodies | Client-side encryption before server; server stores ciphertext only |
| Files | E2E ciphertext in GridFS; conversation ACL on download |
| Private key | PBKDF2 + AES-GCM wrap; decrypted key in memory only (vault) |
| Sessions | HttpOnly cookie (web) or memory + encrypted device wrap (installed); Redis revocation in production |
| 24h recycle | Mongo TTL on messages, files, stories, conversations |

**Panic wipe:** Deletes chats, files, stories, sessions, device secrets. **Keeps** account + contacts.

---

## 2. Two encryption layers (important)

SSC currently runs **two systems in parallel** during migration:

| Layer | Algorithm | Used for |
|-------|-----------|----------|
| **Legacy RSA** | RSA-OAEP 2048 + AES-256-GCM per message | Web/PWA, groups, attachments, stories, old messages, account registration |
| **Signal `signal_v1`** | X3DH + Double Ratchet (libsignal 0.96.2) | Android APK: 1:1 text, attachments, call signaling when both peers ready |
| **Signal `signal_group_v1`** | Sender Keys (libsignal 0.96.2) | Android APK: group messages when all members have 1:1 sessions |
| **Signal `signal_status_v1`** | Sender Keys (libsignal 0.96.2) | Android APK: stories to contacts when sessions ready |

UI labels: **SIG** (green) vs **RSA** (yellow) on messages and composer hints.

---

## 3. Coverage by surface (today)

### Android APK (native libsignal)

| Surface | Encrypted? | Protocol |
|---------|------------|----------|
| 1:1 text | ✅ Ratchet | `signal_v1` when both peers have prekeys + session |
| 1:1 text fallback | ✅ E2E | `legacy_rsa` (peer not upgraded, no session) |
| 1:1 attachments | ✅ Ratchet | `signal_v1` when session ready; else `legacy_rsa` |
| Group messages | ✅ Sender Keys | `signal_group_v1` when all members ready; else `legacy_rsa` |
| 1:1 call signaling (SDP/ICE) | ✅ Ratchet-wrapped | `signaling_protocol: signal_v1` |
| Group call signaling | ✅ Sender Keys wrap | Legacy fallback |
| Stories / statuses | ✅ Sender Keys | `legacy_rsa` fallback |
| Call media (audio/video) | ✅ P2P WebRTC | Encrypted by DTLS-SRTP between peers |
| Translation | ✅ On-device | Google ML Kit — plaintext never leaves phone |

### Windows / Mac desktop (Engine 10)

| Surface | Encrypted? | Protocol |
|---------|------------|----------|
| Same as Android APK | ✅ libsignal | `signal_v1` / `signal_group_v1` / `signal_status_v1` |

### Browser dev shell (not a product)

| Surface | Encrypted? | Protocol |
|---------|------------|----------|
| All messaging | ✅ E2E | `legacy_rsa` only — **no libsignal in browser tab** |
| Call signaling | ⚠️ Cleartext on server relay | Legacy |

---

## 4. Should the whole app use Signal?

**Yes — on every installed client.** Android, Windows, and Mac use official libsignal **0.96.2**. Browser-tab Web/PWA is **not a product surface** (RSA legacy for founder dev only). Engine 8.10 browser WASM is **retired**; Engine 10 desktop replaces it.

**P1 complete:** unified identity (curve primary) · contacts graph privacy (server-blind).

**Will stay RSA-based:** Account vault unlock (password → private key). Orthogonal to ratchet transport.

---

## 5. What the server can see

| Data | Server sees |
|------|-------------|
| `signal_v1` messages | Opaque ciphertext + `signal_message_type` |
| `legacy_rsa` messages | Ciphertext + IV + per-user wrapped keys |
| 1:1 call signaling (upgraded) | Opaque `signaling_ciphertext` only |
| Group call signaling | SDP + ICE (cleartext) |
| Contacts | Blind seals + pepper-encrypted rosters — **staff cannot read graph from DB export** |
| Push | Generic body; routing metadata (tokens, conversation_id) |
| Translation (Android APK) | **On-device only** (ML Kit) — decrypted text never sent to server |
| Translation (web, dev only) | **Plaintext** if `TRANSLATION_ENABLED=true` — off in production |

---

## 6. Comparison to Signal & WhatsApp (honest)

| Capability | SSC (today) | Signal / WhatsApp |
|------------|-------------|-------------------|
| 1:1 text ratchet (installed clients) | ✅ libsignal | ✅ |
| 1:1 text (browser dev) | Legacy RSA | Full protocol |
| Groups (installed clients) | ✅ Sender Keys | Sender Keys |
| Attachments (installed clients) | ✅ In-protocol | In-protocol |
| Sealed sender | ✅ 1:1 installed clients | Signal ✅ |
| Multi-device | ✅ linked devices (Q.51) | ✅ |
| Default server deletion | 24h TTL (strong default) | Optional disappearing |
| Published audit | ❌ | Years of scrutiny |
| Global HTTPS prod | ✅ Cloud Run | ✅ |

**Marketing rule:** Say **"Signal-grade E2E on installed apps (Android, Windows, Mac)"** — do not claim browser-tab chat is Signal-grade.

---

## 7. Third-party & compliance

| Item | Status |
|------|--------|
| libsignal | Official `@signalapp` / `org.signal` only · **AGPL-3.0** — compliance complete (`memory/AGPL_COMPLIANCE.md`) |
| Google OAuth / FCM / Firebase | Configured · project `super-chat-b0992` |
| Mongo Atlas | Production database |
| Translation | Android: Google ML Kit on-device · Server: MyMemory (dev only, disabled in prod) |

---

## 8. Production endpoints

- API: `https://ssc-api-4jp3wuccwa-ew.a.run.app`
- OAuth callback: `https://ssc-api-4jp3wuccwa-ew.a.run.app/api/auth/google/callback`
- APK must use Cloud Run URL (not LAN IP) for testers