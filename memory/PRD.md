# SSC — Super Secure Chat · PRD

> **Roadmap (single source of truth):** `memory/SSC-ROADMAP.md`  
> **Security model:** `memory/SECURITY_MODEL.md`  
> **Updated:** 2026-06-24

## Product summary

SSC is a hybrid full-stack E2E-encrypted ephemeral messaging app (WhatsApp/Telegram-style). Chats, files, calls, and stories auto-delete after 24h. Contacts are added via **username search + mutual friend requests** (invite links retired).

**Platforms (product):** **Installed clients only** — Android APK · Windows desktop · Mac desktop.  
**Not a product (permanent):** browser-tab Web/PWA — download landing only; no PWA comeback planned.  
**Deferred:** iOS App Store (scaffold exists).  
**Production API:** `https://ssc-api-4jp3wuccwa-ew.a.run.app` (Cloud Run HTTPS).

## Original problem statement

Build a WhatsApp/Telegram-like app with:

- 24h auto-recycle of chats, calls, files
- Built-in auto-translation (on-device on Android)
- Strong E2E encryption (libsignal on installed clients)
- Voice, video calls, file send/receive
- Panic wipe/log-out (keeps account + friends)
- Login: email+password OR Google (no phone number)
- Recovery via email+password only
- Username creation rules (4–12, no abuse, no SSC, no admin, no emoji)
- Anti-phishing, anti-bot, anti-spam
- Works on **installed** Android + Windows + Mac apps only

## Architecture (current)

- **Backend:** FastAPI + MongoDB Atlas (TTL indexes for 24h auto-delete) + Redis (production rate limits + session revocation)
- **Realtime:** WebSocket (`/api/ws`) for messages, typing, read receipts, WebRTC signaling; Redis pub-sub for multi-worker
- **E2E encryption (installed clients):**
  - **Android + Windows + Mac:** Signal Protocol (libsignal **0.96.4**, PQXDH) on 1:1, groups, stories, attachments, call signaling
  - **Unified identity:** Curve25519 primary (`identity_primary: signal_v1`); RSA vault-wrap only
  - **Contact graph:** Blind seals + pepper-encrypted rosters (`CONTACT_GRAPH_PEPPER`)
  - **Browser dev shell:** Legacy RSA only — founder localhost with `REACT_APP_BROWSER_DEV=true`; not marketed
  - **Account unlock:** RSA vault wrapped with PBKDF2(password)
  - Server only stores ciphertext (plus blind social-graph seals)
- **Auth:** In-memory JWT (installed clients) · HttpOnly cookie (dev shell) · email/password · Google OAuth · TOTP 2FA + backup codes · Turnstile (production when domain live) · rate limiting
- **Translation:** On-device ML Kit on Android; server translation **off by default**
- **Calls:** WebRTC mesh up to **8** participants; TURN via metered.ca
- **Push:** FCM (Android); Web VAPID retired as product surface

## Security engines (shipped)

| Engine | Scope |
|--------|--------|
| 1–5 | Retention, E2E integrity, footprint, metadata, sessions |
| 8 — Signal Protocol | libsignal on installed clients (8.10 browser WASM **retired permanently**) |
| 9 — Translation privacy | On-device ML Kit (Android) |
| 10 — Desktop | Electron + libsignal Node (Windows + Mac) |

All gates pass — see `memory/SSC-ROADMAP.md`.

## Implemented (MVP + post-MVP)

- Core messaging, groups, stories, calls, panic wipe, OAuth, blind contact graph
- Capacitor Android APK with full Signal surfaces
- Windows desktop installer (Electron + libsignal)
- Mac desktop build config (`.dmg` on macOS)
- AGPL compliance artifacts
- **Settings → Security:** 2FA management, Signal/vault status, panic explanation, app version
- **First-run onboarding:** 3-step coach (installed-only, verify contacts, panic wipe)
- InstalledClientGate — no browser-tab register/chat

## Remaining before wider testers (P0)

| Item | Owner | Notes |
|------|-------|-------|
| **Redeploy Cloud Run** | Founder | Push latest `main`; set `CONTACT_GRAPH_PEPPER` in `cloud_run.env` |
| **Reset 3 tester accounts** | Founder | After deploy — unified identity + blind graph |
| **Custom domain + Turnstile** | ~28 Jun 2026 | Bot/spam on register/login |
| **Two-phone smoke** | Founder manual | Signal text, attachment, call, translate, panic, re-login |
| **TURN verification** | Founder manual | Cellular + Wi‑Fi mix with metered.ca |

## Deferred (not blocking MVP testers)

- **SFU Phase B** — group calls 9+ (mediasoup; mesh cap 8 today)
- **iOS** — App Store ($99/yr + Mac build host)
- **Play Store public listing** — AGPL done; listing pending
- **Engine 6.3** — own-metal migration runbook (post-investors)
- **Sealed sender / multi-device** — future security hardening

## Deploy checklist (production)

```powershell
# 1. Ensure cloud_run.env includes (never commit):
#    CONTACT_GRAPH_PEPPER=<long-random-secret>
#    JWT_SECRET, MONGO_URL, REDIS_URL, TURN_*, VAPID_*, GOOGLE_*

# 2. Deploy backend
cd C:\Users\smash\SSC-main\backend
.\scripts\deploy_cloud_run.ps1   # or your deploy script

# 3. Verify
Invoke-RestMethod https://ssc-api-4jp3wuccwa-ew.a.run.app/api/health

# 4. Rebuild clients with production API URL
cd C:\Users\smash\SSC-main
.\SSC-BUILD-APK.bat
.\SSC-BUILD-DESKTOP-WIN.bat

# 5. Distribute via Firebase App Distribution + desktop installer
# 6. Run two-phone smoke on real devices
```

## Test health (2026-06-24)

| Metric | Value |
|--------|-------|
| Backend pytest | **528 passed**, 1 skipped |
| Engine 1–5, 8–10 gates | **PASS** |
| Unified identity + contacts graph + AGPL gates | **PASS** |
| Frontend `yarn test:ci` | **PASS** |
| `e2e_smoke.py` | **PASS** (local backend) |
| Production `/api/health` | **PASS** |

## Product positioning (honest)

**Offer:** 24h default deletion · Signal-grade E2E on installed apps · panic wipe · no phone number · on-device translate (Android) · blind contact graph · AGPL transparency.

**Do not claim:** “More secure than Signal” · browser chat · iOS app · unlimited group calls · server-blind everything (pending friend requests have TTL metadata).

**Target users:** Privacy-conscious small groups (5–20) who accept username-add and 24h ephemerality.