# SSC — Super Secure Chat · PRD

## Original problem statement
Build a WhatsApp/Telegram-like app with:
- 24h auto-recycle of chats, calls, files
- Built-in auto-translation
- Strong encryption (E2E, "double/triple")
- Voice, video calls, file send/receive
- Panic wipe/log-out
- Login: email+password OR Google (no phone number)
- Recovery via email+password only
- Username creation rules (4–12, no abuse, no SSC, no admin, no emoji)
- Anti-phishing, anti-bot, anti-spam
- Works on any device (PWA)

## Architecture
- **Backend**: FastAPI + MongoDB (TTL indexes for 24h auto-delete)
- **Realtime**: WebSocket (`/api/ws`) for messages, typing, read receipts, WebRTC signaling
- **E2E encryption**: RSA-OAEP 2048 + AES-256-GCM client-side, per-message ephemeral AES key (message-level forward secrecy). Private keys wrapped with PBKDF2(password). Server only sees ciphertext.
- **Auth**: JWT (email/password) + (Google OAuth disabled in standalone; easy to add your own) + TOTP 2FA + Cloudflare Turnstile captcha + per-IP rate limiting
- **Translation**: Pluggable (currently stub / no-op until you configure a provider)
- **File storage**: MongoDB GridFS with TTL metadata (24h) — fully self-contained, no external storage service
- **Calls**: WebRTC peer-to-peer with STUN
- **PWA**: Installable on iOS, Android, desktop; service worker; web push (VAPID)

## Implemented

### Iteration 1 (2026-06-17)
- ✅ Landing + Auth (email/password primary; Google OAuth stubbed/disabled)
- ✅ Username validation (4–12, blocks SSC/ADMIN/NSFW)
- ✅ Client-side RSA-OAEP + PBKDF2 + AES-GCM private-key wrapping
- ✅ Conversation creation by username search
- ✅ E2E encrypted messaging (per-recipient wrapped keys, per-message ephemeral AES)
- ✅ Realtime WebSocket + typing indicator
- ✅ Auto-translation toggle per chat (stub in standalone; wire your provider to activate)
- ✅ Countdown badge + MongoDB TTL for 24h recycle
- ✅ File upload (Mongo GridFS, 24h TTL)
- ✅ WebRTC voice + video calls (P2P)
- ✅ Panic wipe (1.5s hold) — wipes chats/files/calls; **account + friends survive**; auto logout
- ✅ Encrypted vault unlock prompt
- ✅ 35/35 backend tests pass

### Iteration 2 (2026-06-17)
- ✅ Cloudflare Turnstile captcha at register + login
- ✅ Per-IP rate limiting (5 register/hr, 10 login/5min)
- ✅ TOTP 2FA (pyotp) — setup with QR, verify, disable, login challenge
- ✅ Web push notifications (VAPID) — backend send + service worker + subscription
- ✅ PWA — manifest.json, service worker, app icons, installable
- ✅ Group chats — multi-recipient encryption, member picker UI
- ✅ Read receipts — single check (sent), double check gray (read by some), double check cyan (read by all)
- ✅ Security: FIX — TOTP secret leak via /auth/me (caught by testing agent, fixed)
- ✅ 58/58 backend tests pass

### Iteration 3 (2026-06-17)
- ✅ **Verified handshake** — safety number (60-char fingerprint of both public keys) + QR code modal; mark peer as verified, badge in chat header
- ✅ **Group voice/video calls** — full-mesh WebRTC up to ~6 participants; signaling reuses existing `call-*` WS events with `group: true` flag
- ✅ **Status / Stories** — 24h E2E-encrypted ephemeral posts (text + background colors); stories bar at top of sidebar; auto-advance viewer; viewer count for author
- ✅ **Server-side validation** that `encrypted_keys` covers every conversation participant — prevents lock-out attacks
- ✅ **Privacy hardening** — GET /statuses now projects encrypted_keys to caller's entry only (no recipient enumeration); viewers list only visible to author
- ✅ 79/79 backend tests pass (58 regression + 21 new)

## Deferred / next iterations
- **Full Signal Protocol (X3DH + Double Ratchet)** — provides asymmetric-level forward secrecy with per-message ratcheting. Current implementation has per-message symmetric ephemeral AES keys (already a form of message-level forward secrecy) and per-peer manual verification. Full Signal Protocol is a multi-week project on its own.
- **React Native / native app store wrappers** — PWA already works on iOS/Android/desktop and is installable. For Apple App Store / Google Play presence we'd wrap with **Capacitor.js**, requiring Apple Developer account ($99/yr) + Mac for iOS builds. Separate project.
- **Real Cloudflare Turnstile keys** — get from dash.cloudflare.com → Turnstile → "Add Site". Replace `TURNSTILE_SITEKEY` + `TURNSTILE_SECRET` in `/app/backend/.env`.
- **Redis-backed rate limit** for multi-worker prod
- **Group voice/video for >6 participants** — needs SFU (e.g. mediasoup, LiveKit)
- **Server-side modular split** — server.py is 1082 lines
- **2FA backup codes**
- **Invite links** with one-time encryption handshake

## Endpoints (current)
### Auth
- `POST /api/auth/register` — captcha_token, email, password, username, public_key, encrypted_private_key, pk_salt, language
- `POST /api/auth/login` — email, password, totp_code (if 2FA), captcha_token
- `GET  /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/check-username`
- `POST /api/auth/google/session`
- `POST /api/auth/google/finish-setup`
- `POST /api/auth/2fa/setup` → secret + otpauth_url
- `POST /api/auth/2fa/verify` — code
- `POST /api/auth/2fa/disable` — code

### Users / Conversations / Messages
- `GET  /api/users/search?q=`
- `GET  /api/users/{user_id}/public`
- `PATCH /api/users/me`
- `POST /api/conversations` (1-on-1 OR group with `is_group:true`, `peer_usernames`, `name`)
- `GET  /api/conversations`
- `GET  /api/conversations/{id}/messages`
- `GET  /api/conversations/{id}/reads`
- `POST /api/messages` — encrypted blob + encrypted_keys per recipient
- `POST /api/messages/read` — mark conversation read
- `DELETE /api/conversations/{id}`

### Translation / Files / Push
- `POST /api/translate`
- `POST /api/files/upload`
- `GET  /api/files/{file_id}`
- `POST /api/push/subscribe`
- `POST /api/push/unsubscribe`
- `GET  /api/push/public-key`
- `GET  /api/config`
- `POST /api/panic-wipe`
- `WS   /api/ws?token=` — messages, typing, read, conversation-created, WebRTC signaling
