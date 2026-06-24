# SSC Roadmap — single source of truth

**Updated:** 2026-06-24 (execution plan · vault policy · founder QA backlog)
**Repo:** `C:\Users\smash\SSC-main`
**Rule:** After every engine step, feature, or deploy — update **this file only**. Do not maintain parallel roadmaps.

**Companion docs:** `memory/SECURITY_MODEL.md` · `memory/UNIFIED_IDENTITY_CHARTER.md` · `memory/PRD.md`
**Gate commands:** `backend/scripts/run_engineN_gate.py`

---

## How to use this doc

1. **Done** — Engines 1–5, 8–10, 9 + production deploy + v1.0.4 builds (see §Foundation).
2. **Next** — Pick a **TASK** below (A → J). Each has **subtasks** with checkboxes.
3. **After each subtask** — Run tests, bump build if user-facing, check off here, founder retest on smashmaxxx ↔ dots.
4. **Release gate** — TASK I (QA matrix) must be green before Firebase testers beyond founder.

**Current builds:** APK v1.0.4 build 6 · Windows `SSC-Setup-1.0.4.exe` · API `ssc-api-00012-bbc`

---

## Live infrastructure (verified 24 Jun 2026)

| Service | URL / status | Notes |
|---------|----------------|-------|
| **Production API** | `https://ssc-api-4jp3wuccwa-ew.a.run.app` | Cloud Run · `env=production` · mongo ✅ · redis ✅ |
| **Firebase project** | `super-chat-b0992` | App Distribution, FCM push, Hosting (`super-chat-b0992.web.app`) |
| **MongoDB** | Atlas `ssc` cluster | Network: allow Cloud Run (0.0.0.0/0) |
| **Redis** | Upstash (production) | Required for `ENV=production` |
| **APK API URL** | Cloud Run (baked in build) | `frontend/.env.production.local` |
| **Google OAuth** | ✅ Wired (phone + desktop) | Android `chat.ssc.secure://app` · desktop `chat.ssc.secure.desktop://` |
| **Release builds** | v1.0.4 / build 6 | APK `Desktop\SSC\APK\SSC-app-release.apk` · Win `Desktop\SSC\Setup-1.0.4.exe` |
| **LAN dev** | ✅ Docker mongo + redis + local backend | Founder laptop only — never give LAN IP to testers |

---

## Foundation — completed (do not re-do)

### Engines ✅

| Engine | Status | Notes |
|--------|--------|-------|
| 1 Retention | ✅ | TTL, plaintext leaks closed |
| 2 E2E integrity | ✅ | Vault policy, file ACL, verification |
| 3 Client footprint | ✅ | Panic orchestrator, storage purge |
| 4 Metadata minimization | ✅ | last_seen, generic push |
| 5 Session hardening | ✅ | HttpOnly web · in-memory native JWT · Redis revocation |
| 8 Signal Protocol | ✅ | libsignal 0.96.2 · 1:1, groups, stories, call signaling |
| 9 Translation | ✅ | On-device ML Kit (Android) |
| 10 Desktop | ✅ | Electron + libsignal · Windows NSIS · Mac dmg config |
| 6 Push / own-metal | ✅ eval | FCM + Atlas kept; 6.3 migration deferred post-investors |

### Product surfaces shipped ✅

| Feature | Status |
|---------|--------|
| 1:1 + group chat | ✅ |
| E2E files | ✅ |
| Voice/video 1:1 + group (mesh ≤8) | ✅ |
| Stories 24h | ✅ |
| Contacts + friend requests | ✅ |
| 2FA TOTP + backup codes | ✅ |
| Panic wipe | ✅ |
| Push FCM | ✅ |
| Android APK + Windows desktop | ✅ |
| Google OAuth (native + desktop) | ✅ |
| Unified identity + contacts graph privacy | ✅ |
| Web/PWA as product | **Retired** — download landing only |
| HIGH audit batch (OAuth, deep links, dev/prod) | ✅ `241ff6c` |

### Test health (24 Jun 2026)

| Metric | Value |
|--------|-------|
| pytest | **538 passed**, 1 skipped |
| Engine 1–5, 8, 9, 10 gates | **PASS** |
| Unified identity + contacts graph gates | **PASS** |
| `e2e_smoke.py` + production `/api/health` | **PASS** |
| Frontend `yarn test:ci` | **29 passed** |

---

## Founder product policy (locked)

| Topic | Decision |
|-------|----------|
| **Vault** | **Security stays; users never see it.** RSA wrap remains on server; unlock is automatic on device. No “vault open/closed”, no unlock banners, no “Access your vault” copy. “Vault in concrete.” |
| **Messaging crypto** | **libsignal only** in user-facing story. Dual-read RSA stays internal until retired. |
| **Auto Signal** | Bootstrap X3DH + ratchet **silently** on installed clients at login / first contact. No “upgrade encryption” UI. |
| **QR / safety numbers** | Not MVP for remote users (US ↔ UK). Hide VERIFY from default chat; optional advanced Settings later. |
| **Email** | Google → `email_verified`, no extra link. Password register → confirmation link later (non-Google). |
| **Surfaces** | Installed apps only: Android APK, Windows/Mac desktop. iOS deferred. |

---

## Execution plan — main tasks & subtasks

**Legend:** `[ ]` open · `[~]` in progress · `[x]` done

---

### TASK A — Invisible security (vault + crypto UX) · *founder priority*

**Goal:** WhatsApp-like — crypto runs; user never manages keys or vault.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| A.1 | Remove **vault locked banner** from chat | `ChatHome.jsx`, `i18n.js` | [ ] |
| A.2 | Remove **Settings vault ABIERTO/BLOQUEADO** row (or replace with neutral “Messages protected” — no key state) | `SettingsModal.jsx` | [ ] |
| A.3 | Change login/register copy — no “vault”; use “Sign in” / “Create account” | `i18n.js`, `Login.jsx`, `Register.jsx` | [ ] |
| A.4 | **Email/password login** — keep silent auto-unlock (already calls `unlockPrivateKey`) | `Login.jsx`, `AuthContext.jsx` | [x] |
| A.5 | **Google login** — auto-unlock vault without user prompt | Options: (a) device secure storage for vault password set at finish-setup; (b) unlock immediately after `SetupUsername` and persist device credential; (c) derive wrap key from platform keystore. **Must not** show vault UI. | `GoogleAuthCallback.jsx`, `SetupUsername.jsx`, `sessionStore` / Capacitor Secure Storage | [ ] |
| A.6 | Remove **legacy / upgrade / E2E established** banners from chat | `ChatHome.jsx`, related components | [ ] |
| A.7 | Hide **VERIFY / QR** from default chat header; move to Settings → Advanced (or remove from v1) | `ChatHome.jsx`, `VerifyHandshakeModal.jsx` | [ ] |
| A.8 | **Silent Signal bootstrap** on login for installed clients (`ensurePreKeysUploaded` + session warm-up) | `AuthContext.jsx`, `signalIdentityBootstrap.js` | [ ] |
| A.9 | Remove **SIG/RSA protocol labels** from message bubbles (internal logs only) | `Message.jsx`, composer hints | [ ] |
| A.10 | Gate: founder two-device chat shows **no crypto jargon**; messages send/receive encrypted | Manual QA smashmaxxx ↔ dots | [ ] |

---

### TASK B — Session persistence (stay logged in) · P0-2

**Goal:** Force-close app → reopen → still logged in. Logout only explicit or panic wipe.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| B.1 | Persist JWT in **native secure storage** (Android Keystore / EncryptedSharedPreferences; desktop OS credential store) | New `lib/nativeSessionStore.js`, Capacitor plugin or `@capacitor/preferences` + encrypt | [ ] |
| B.2 | Restore session on cold start before routing to `/login` | `AuthContext.jsx`, `App.js`, `Protected` route | [ ] |
| B.3 | **Panic wipe** + **logout** clear secure storage | `clientFootprintOrchestrator.js`, `AuthContext.jsx` | [ ] |
| B.4 | Engine 5 policy doc note — update accepted tradeoff if persistence ships | `memory/CLIENT_FOOTPRINT_CHARTER.md` | [ ] |
| B.5 | QA: force-stop Android → reopen → chat list without Google again | Founder dots device | [ ] |

---

### TASK C — Real-time contacts & friend requests · P0-1

**Goal:** Pending badge and roster update live while app is open.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| C.1 | Audit WS events for `friend-request`, `contact-accepted`, roster refresh | `backend` WS handlers, `frontend` WS client | [ ] |
| C.2 | On event → refresh contacts + pending count without restart | `ChatHome.jsx`, contacts context/hooks | [ ] |
| C.3 | FCM data message → same refresh when backgrounded | Push handler | [ ] |
| C.4 | QA: send request PC → phone shows pending **without** restart | smashmaxxx → dots | [ ] |
| C.5 | QA: accept on phone → PC roster updates live | dots → smashmaxxx | [ ] |

---

### TASK D — Android permissions & calls · P0-3, P0-4

**Goal:** Mic, camera, notifications work; full duplex calls both ways.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| D.1 | Request **RECORD_AUDIO** + **CAMERA** at right moments (call, voice note, video) | Capacitor permissions, `CallOverlay` / voice recorder | [ ] |
| D.2 | Handle permission denied → clear in-app message + Settings deep link | UI toasts | [ ] |
| D.3 | Fix **incoming call UI** on Android — answer/decline visible | `CallOverlay.jsx`, native layer | [ ] |
| D.4 | Fix **audio routing** — earpiece vs speaker; WebRTC `getUserMedia` after grant | WebRTC call module | [ ] |
| D.5 | **Ringtone** on callee (phone + desktop) | `CallOverlay`, assets | [ ] |
| D.6 | Desktop → phone **video**: callee can answer; **audio** both directions | End-to-end call test | [ ] |
| D.7 | QA matrix: voice call, video call, cancel, busy | Two devices | [ ] |

---

### TASK E — Attachments & media · P0-5, P0-6

**Goal:** Voice notes, images, files open, play, zoom, download.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| E.1 | **Voice note record** — fix empty upload (desktop mic red but no blob) | Recorder component, file upload pipeline | [ ] |
| E.2 | Voice note **playback** on peer (Signal + RSA paths) | `Message.jsx`, attachment decrypt | [ ] |
| E.3 | **Image preview** modal — tap to open, pinch/zoom, save | New or fix `ImagePreview` | [ ] |
| E.4 | Screenshot paste vs file attach — same encrypted attachment UX | Composer | [ ] |
| E.5 | Plain file attach (non-image) — name, size, download | File message type | [ ] |
| E.6 | QA: PC ↔ phone image + voice note round-trip | Two devices | [ ] |

---

### TASK F — Chat actions & groups · P0-7, P0-8

**Goal:** Block, mute, group create work on all clients.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| F.1 | **Block** — API call + hide thread + reject inbound | `ChatHome.jsx`, backend block endpoints | [ ] |
| F.2 | **Mute** — persist per-conversation; silence push | Settings / conversation menu | [ ] |
| F.3 | **Create group** — fix Create button (API + navigation) | Group create modal, `conversations.py` | [ ] |
| F.4 | **Group naming** (P1-4) — require title or auto “Alice, Bob +N” | Create flow + list display | [ ] |
| F.5 | QA: block/mute on PC + phone; create 2-member group; send message | Two devices | [ ] |

---

### TASK G — OAuth & navigation polish · P0-9, P0-10, P2-2

**Goal:** Clean OAuth return; Android back behaves like WhatsApp.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| G.1 | **Close OAuth WebView** after deep link return (Android) | `google-auth.js`, `capacitor-init.js`, Browser plugin | [ ] |
| G.2 | `leaveChat()` use `navigate('/chat', { replace: true })` | `ChatHome.jsx` | [ ] |
| G.3 | Capacitor **`App.addListener('backButton')`** — list = minimize/exit, not re-enter thread | `capacitor-init.js` or `App.js` | [ ] |
| G.4 | Prevent duplicate `/chat` ↔ `/chat/:id` history entries | React Router audit | [ ] |
| G.5 | System back on chat list → minimize app (WhatsApp-style) | Android behavior | [ ] |
| G.6 | QA: Samsung gesture back — never “folder” reopen loop | dots device | [ ] |

---

### TASK H — UX polish (P1 backlog)

**Goal:** VIP feel; fewer dead ends.

| ID | Subtask | Ref | Status |
|----|---------|-----|--------|
| H.1 | **Contact picker** for new chat/group — list accepted contacts + checkboxes | P1-3 | [ ] |
| H.2 | **Non-mutual messaging** — block send; show “request pending” | P1-5 | [ ] |
| H.3 | **Chat header menu z-index** — menu above bubbles | P1-6 | [ ] |
| H.4 | **Settings pro pass** — real version 1.0.4+, sections Profile/Security/Preferences/About | P1-7 | [ ] |
| H.5 | **Google-only account** — error “Use Google sign-in” not “invalid credentials” | P1-9 | [ ] |
| H.6 | Trim **onboarding coach** floating text in threads | P2-3 | [ ] |
| H.7 | **Profile tap** sheet (mute, block) — defer if not MVP | P1-10 | [ ] |
| H.8 | Desktop **incoming call ringtone** | P2-1 | [ ] |

---

### TASK I — Infrastructure & release prep

| ID | Subtask | Target | Status |
|----|---------|--------|--------|
| I.1 | **Custom domain** + DNS for API / hosting | ~28 Jun 2026 | [ ] |
| I.2 | **Turnstile** captcha on production register/login | ~28 Jun 2026 | [ ] |
| I.3 | **TURN** verification off-LAN (cellular ↔ Wi‑Fi calls) | Founder manual | [ ] |
| I.4 | **Retention proof** — 24h delete on smashmaxxx ↔ dots thread | In progress | [~] |
| I.5 | Rebuild **APK + desktop** after TASK batches; bump version | Post-fix | [ ] |
| I.6 | **Play Store** listing (AGPL review ✅) | Post-P0 | [ ] |
| I.7 | Redeploy Cloud Run when backend changes | Per deploy | [ ] |

---

### TASK J — QA verification matrix (before wider testers)

Run on **smashmaxxx (Win)** + **dots (Android)** against production API.

| Area | Test | Depends on | Status |
|------|------|------------|--------|
| Auth | Google login both devices | — | [x] |
| Auth | Stay logged in after force-close | TASK B | [ ] |
| Auth | Google-only email login shows friendly error | TASK H.5 | [ ] |
| Contacts | Friend request live (send + accept) | TASK C | [ ] |
| Chat | 1:1 text real-time | — | [x] |
| Chat | No vault / legacy / upgrade UI | TASK A | [ ] |
| Chat | Image + voice note + file | TASK E | [ ] |
| Chat | Block + mute | TASK F | [ ] |
| Groups | Create + name + message | TASK F | [ ] |
| Calls | Voice + video duplex + ring | TASK D | [ ] |
| Stories | Post + 24h expiry | — | [ ] |
| Security | Panic wipe (data gone, account remains) | — | [ ] |
| Security | 2FA enable + login | — | [ ] |
| Push | Message + friend request when backgrounded | TASK C | [ ] |
| Translate | On-device Android (different languages) | — | [ ] |
| Retention | Messages gone after 24h | TASK I.4 | [~] |
| Nav | Android system back correct | TASK G | [ ] |
| Multi | Same account phone + desktop simultaneous | — | [ ] |
| Offline | Queue + reconnect | — | [ ] |

---

### TASK K — Deferred (not now)

| Item | Notes |
|------|-------|
| iOS app + libsignal + App Store | Scaffold exists `frontend/ios/` |
| Engine 6.3 own-metal migration | Post-investors |
| SFU / mediasoup (9+ group video) | Phase B |
| Email confirmation for password register | v2 |
| Verified badge (`email_verified`) | v2 cosmetic |
| Profile sheet / safety numbers in Settings advanced | v2 |

---

## Recommended start order (pick one — founder decides)

| Order | Rationale |
|-------|-----------|
| **1 → A then B then C** | *Product feel first:* hide vault/crypto noise, stay logged in, live contacts — biggest “not like WhatsApp” gaps |
| **2 → C then B then D** | *Connectivity first:* real-time social graph + session + calls — unblock daily use |
| **3 → G then D then E** | *Android pain first:* back stack + permissions + media — dots device UX |
| **4 → A only (sprint)** | Quick win: invisible security UX before touching backend |

**Suggested default:** **TASK A** (invisible security) → **TASK B** (session) → **TASK C** (real-time) → **TASK G** (Android back) → **TASK D/E/F** in parallel where possible.

---

## Founder QA snapshot (24 Jun 2026)

**Devices:** Windows `smashmaxxx` v1.0.4 ↔ Android `dots` v1.0.3–1.0.4 · Production API

### Worked ✅

Google OAuth · friend request (after restart) · 1:1 chat · PC→phone video (camera) · delete contact · Google avatar · partial Settings

### Broken → mapped to tasks

| Issue | Task |
|-------|------|
| P0-1 Friend request not live | C |
| P0-2 Session lost on force-close | B |
| P0-3 Android mic/camera permissions | D |
| P0-4 Calls one-way / no audio / no ring | D |
| P0-5 Desktop voice note empty | E |
| P0-6 Images not previewable | E |
| P0-7 Block + mute broken on PC | F |
| P0-8 Create group broken | F |
| P0-9 OAuth window stays open | G |
| P0-10 Android back “folder” bug | G |
| P1-1 Legacy/upgrade banners | A |
| P1-2 VERIFY/QR in chat | A |
| P1-8 Vault prompt on re-login | A |
| P1-3–P1-10 UX polish | H |

---

## Engineering notes

| Topic | Explanation |
|-------|-------------|
| **Vault** | RSA private key wrapped with user password (`encrypted_private_key` + `pk_salt`). Unlock = decrypt to memory only (`AuthContext.unlockPrivateKey`). **Not** the same as Signal keys. Policy: invisible to users. |
| **Signal** | libsignal on device — primary E2E for installed clients. `ensurePreKeysUploaded()` on login. |
| **Legacy RSA** | Dual-read internal fallback. No user-facing “upgrade”. |
| **Google vs password** | Google = session; SSC password from finish-setup = vault wrap. Email login on Google-only account must fail with clear copy. |
| **Session** | Engine 5: native JWT in memory today — force-stop clears it. TASK B adds secure persistence without weakening panic wipe. |
| **Back stack** | `leaveChat()` push + system back pops into `/chat/:id`. Fix: `replace: true` + Capacitor `backButton`. |

---

## Testing & deploy (founder — locked)

| Mode | Use |
|------|-----|
| LAN / localhost | Founder laptop only |
| **Firebase App Distribution** | Real testers — production API in APK |
| **Cloud Run HTTPS** | `https://ssc-api-4jp3wuccwa-ew.a.run.app` |
| LAN IP | **Never** give to testers |

```powershell
cd C:\Users\smash\SSC-main\backend
.\venv\Scripts\python.exe scripts\run_engine8_gate.py
.\venv\Scripts\python.exe scripts\run_engine9_gate.py
.\venv\Scripts\python.exe -m pytest -q
```

```powershell
cd C:\Users\smash\SSC-main\frontend
yarn test:ci
```

**Rebuild after user-facing fixes:**
- APK: `SSC-BUILD-APK.bat` → `Desktop\SSC\APK\`
- Desktop: `SSC-BUILD-DESKTOP-WIN.bat` → `Desktop\SSC\SSC-Setup-x.x.x.exe`

---

## Signal coverage reference

| Surface | Android | Windows/Mac | Browser (dev only) |
|---------|---------|-------------|-------------------|
| 1:1 text | ✅ `signal_v1` | ✅ | Legacy RSA |
| 1:1 attachments | ✅ | ✅ | Legacy |
| Group messages | ✅ `signal_group_v1` | ✅ | Legacy |
| Call signaling | ✅ encrypted | ✅ | Legacy |
| Stories | ✅ `signal_status_v1` | ✅ | Legacy |
| Account vault (internal) | RSA wrap | RSA wrap | RSA wrap |

---

## Changelog

| Date | Milestone |
|------|-----------|
| 2026-06-17 | MVP iterations 1–3 |
| 2026-06-23 | Engines 1–5, 8 complete |
| 2026-06-24 | Engines 9, 10 · unified identity · contacts privacy |
| 2026-06-24 | HIGH audit · OAuth native redirects · v1.0.4 builds |
| 2026-06-24 | Founder QA smashmaxxx ↔ dots · P0–P2 backlog |
| 2026-06-24 | Founder policy — vault in concrete; auto libsignal; hide verify |
| 2026-06-24 | **Roadmap restructure** — execution plan TASK A–K with subtasks |