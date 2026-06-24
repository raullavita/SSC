# SSC — Super Secure Chat · PRD

> **Roadmap (single source of truth):** `memory/SSC-ROADMAP.md`  
> **Security model:** `memory/SECURITY_MODEL.md`  
> **Updated:** 2026-06-24

## Product summary

SSC is a hybrid full-stack E2E-encrypted ephemeral messaging app (WhatsApp/Telegram-style). Chats, files, calls, and stories auto-delete after 24h. Contacts are added via **username search + mutual friend requests** (invite links retired).

**Platforms:** PWA (web) + Capacitor Android APK. Production API on Cloud Run HTTPS.

## Original problem statement

Build a WhatsApp/Telegram-like app with:

- 24h auto-recycle of chats, calls, files
- Built-in auto-translation
- Strong E2E encryption
- Voice, video calls, file send/receive
- Panic wipe/log-out (keeps account + friends)
- Login: email+password OR Google (no phone number)
- Recovery via email+password only
- Username creation rules (4–12, no abuse, no SSC, no admin, no emoji)
- Anti-phishing, anti-bot, anti-spam
- Works on any device (PWA + native APK)

## Architecture (current)

- **Backend:** FastAPI + MongoDB Atlas (TTL indexes for 24h auto-delete) + Redis (production rate limits + session revocation)
- **Production API:** `https://ssc-api-4jp3wuccwa-ew.a.run.app` (Cloud Run)
- **Realtime:** WebSocket (`/api/ws`) for messages, typing, read receipts, WebRTC signaling
- **E2E encryption:**
  - **Web/PWA:** Legacy RSA-OAEP 2048 + AES-256-GCM (groups, attachments, stories, migration)
  - **Android APK:** Signal Protocol on 1:1 text, 1:1 attachments, group messages (`signal_group_v1`), stories (`signal_status_v1`), and encrypted call signaling (libsignal **0.96.2**, X3DH + Double Ratchet + Sender Keys)
  - **Account unlock:** RSA vault wrapped with PBKDF2(password) — orthogonal to ratchet
  - Server only stores ciphertext
- **Auth:** HttpOnly session cookie (web) + in-memory JWT (native) · email/password · Google OAuth · TOTP 2FA with **10 backup codes** · Cloudflare Turnstile (production) · per-IP rate limiting
- **Translation:** On-device ML Kit on Android APK (Engine 9); server translation **off by default**
- **File storage:** MongoDB GridFS with TTL metadata (24h)
- **Calls:** WebRTC P2P mesh (~6 participants); TURN credentials configured (off-LAN verification pending)
- **Push:** FCM (Android) + Web VAPID
- **PWA:** Installable; service worker; manifest + icons

## Security engines (shipped)

| Engine | Scope |
|--------|--------|
| 1 — Retention | TTL, plaintext leak closure, logging hygiene |
| 2 — E2E integrity | Vault, file ACL, API integrity |
| 3 — Client footprint | Panic orchestrator, SW purge, localStorage policy |
| 4 — Metadata minimization | last_seen, generic push |
| 5 — Session hardening | HttpOnly cookie, native JWT, Redis revocation |
| 8 — Signal Protocol | Android Signal surfaces (8.10 Web blocked — no official WASM) |
| 9 — Translation privacy | On-device ML Kit; no server plaintext on APK |

See `memory/SSC-ROADMAP.md` for gate status and remaining work.

## Implemented (MVP + post-MVP)

### Core messaging
- Landing + Auth (email/password + Google OAuth on web + native)
- Username validation + search-first add contacts (friend requests)
- Client-side RSA-OAEP + PBKDF2 + AES-GCM private-key wrapping
- 1:1 and group E2E encrypted messaging
- Realtime WebSocket + typing + read receipts
- Auto-translation toggle (on-device on Android; server off by default)
- 24h countdown + MongoDB TTL recycle
- File upload (GridFS, encrypted envelope, ACL via message)
- Panic wipe (1.5s hold) — wipes chats/files/calls; account + friends survive; session revoked
- Encrypted vault unlock prompt
- Full UI i18n (EN / ES / RO)

### Security & auth
- Cloudflare Turnstile captcha (register + login)
- Per-IP rate limiting (Redis in production)
- TOTP 2FA — setup QR, verify, disable, login challenge, **backup codes**
- Verified handshake — safety numbers v3 + QR; verified badge in chat
- Google OAuth (web GIS + native redirect via Cloud Run)

### Social & media
- Contacts + friend requests (mutual required before chat)
- Group chats — multi-recipient encryption
- Stories / statuses — 24h E2E ephemeral posts
- Group voice/video calls — mesh WebRTC up to ~6
- 1:1 voice/video calls — WebRTC P2P; Signal-encrypted signaling on Android

### Native / deploy
- Capacitor Android APK (production URL baked via `frontend/.env.production.local`)
- Firebase App Distribution for testers
- FCM native push + Web VAPID push
- PWA installable on iOS/Android/desktop

### Retired
- **Invite links** — removed 2026-06-24; username search is sufficient

## Deferred / remaining (see roadmap)

- **Custom domain + Turnstile** (~28 Jun 2026)
- **Two-phone smoke + TURN verification** (founder manual)
- **Signal on Web** (8.10) — blocked until Signal ships browser WASM
- **Unified identity** — retire dual RSA + Curve25519 registration
- ~~**AGPL legal review**~~ ✅ (`memory/AGPL_COMPLIANCE.md`, `LICENSE`, in-app source offer)
- **WebSocket Redis pub-sub** (multi-worker Cloud Run)
- **SFU** for group calls >6 (mediasoup / LiveKit)
- **iOS Capacitor** ($99/yr + Mac)
- **Engine 6** — own-metal Mongo / push hardening (post-investors)
- **Frontend automated tests** — 13 tests via `yarn test:ci` (expand coverage over time)

## Test health (2026-06-24)

- Backend pytest: **476 passed**, 1 skipped (477 collected)
- Engine 1–5, 8, 9 gates: **PASS**
- `e2e_smoke.py`: **PASS**

## Endpoints (current)

### Auth
- `POST /api/auth/register` — captcha_token, email, password, username, public_key, encrypted_private_key, pk_salt, language
- `POST /api/auth/login` — email, password, totp_code (if 2FA), captcha_token
- `GET  /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/check-username`
- `POST /api/auth/google/session` · `POST /api/auth/google/finish-setup` · `GET /api/auth/google/config`
- `POST /api/auth/2fa/setup` → secret + otpauth_url + backup_codes
- `POST /api/auth/2fa/verify` — code
- `POST /api/auth/2fa/disable` — password + code
- `POST /api/auth/2fa/backups` — regenerate backup codes

### Users / Contacts / Conversations / Messages
- `GET  /api/users/search?q=`
- `GET  /api/users/{user_id}/public`
- `PATCH /api/users/me`
- `POST /api/contacts/request` · `GET /api/contacts` · `POST /api/contacts/requests/accept`
- `POST /api/conversations` (1-on-1 OR group)
- `GET  /api/conversations` · `GET /api/conversations/{id}/messages`
- `POST /api/messages` — encrypted blob + protocol field (`legacy_rsa`, `signal_v1`, `signal_group_v1`, …)
- `POST /api/messages/read` · `DELETE /api/conversations/{id}`

### Signal / Keys (Android)
- `POST /api/keys/prekey-bundle` · `GET /api/keys/prekey-bundle/{user_id}`

### Translation / Files / Push / Status
- `POST /api/translate` (disabled by default in production)
- `POST /api/files/upload` · `GET /api/files/{file_id}`
- `POST /api/push/subscribe` · `GET /api/push/public-key`
- `POST /api/statuses` · `GET /api/statuses`
- `GET  /api/config` · `GET /api/health`
- `POST /api/panic-wipe`
- `WS   /api/ws?token=` — messages, typing, read, calls, WebRTC signaling