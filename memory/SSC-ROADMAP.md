# SSC Roadmap — single source of truth

**Updated:** 2026-06-24 (founder two-device QA · OAuth wired · v1.0.4 builds)
**Repo:** `C:\Users\smash\SSC-main`  
**Rule:** After every engine step, feature, or deploy — update **this file only**. Do not maintain parallel roadmaps.

**Gate commands:** `backend/scripts/run_engineN_gate.py`  
**Security model:** `memory/SECURITY_MODEL.md`

---

## Live infrastructure (verified 24 Jun 2026)

| Service | URL / status | Notes |
|---------|----------------|-------|
| **Production API** | `https://ssc-api-4jp3wuccwa-ew.a.run.app` | Cloud Run · `env=production` · mongo ✅ · redis ✅ |
| **Firebase project** | `super-chat-b0992` | App Distribution, FCM push, Hosting (`super-chat-b0992.web.app`) |
| **MongoDB** | Atlas `ssc` cluster | Network: allow Cloud Run (0.0.0.0/0) |
| **Redis** | Upstash (production) | Required for `ENV=production` |
| **APK API URL** | Cloud Run (baked in build) | `frontend/.env.production.local` |
| **Google OAuth** | ✅ Wired (phone + desktop) | Android `chat.ssc.secure://app` · desktop `chat.ssc.secure.desktop://` · Cloud Run `ssc-api-00012-bbc` |
| **Release builds** | v1.0.4 / build 6 | APK `Desktop\SSC\APK\SSC-app-release.apk` · Win `Desktop\SSC\SSC-Setup-1.0.4.exe` |
| **LAN dev** | ✅ Docker mongo + redis + local backend | Founder laptop only — never give LAN IP to testers |

---

## Engine progress tree

```
Engines 1–5 + 8 + 9  ✅ COMPLETE (gates pass)
Engine 6             ✅ EVALUATION (6.1–6.2 done · 6.3 deferred post-investors)
Engine 10            ✅ DESKTOP (Windows installer · Mac dmg config · libsignal)
```

### Engine 1 — Retention ✅
- [x] 1.1 Charter · 1.2 Plaintext leaks closed · 1.3 TTL indexes · 1.4 Conv metadata · 1.5 Logging · 1.6 Egress map · 1.7 Gate

### Engine 2 — E2E integrity ✅
- [x] 2.1–2.7 (vault, file ACL, API integrity, verification) · Gate ✅ · G1–G5, G7–G8 closed

### Engine 3 — Client footprint ✅
- [x] 3.1–3.7 (panic orchestrator, SW purge, localStorage policy) · Gate ✅

### Engine 4 — Metadata minimization ✅
- [x] 4.1–4.7 (last_seen, generic push, contacts tradeoff) · Gate ✅ · M1–M3, M6 closed

### Engine 5 — Session hardening ✅
- [x] 5.1–5.7 (HttpOnly cookie, native memory JWT, Redis revocation) · Gate ✅ · C8 closed

### Engine 8 — Signal Protocol ✅
- [x] 8.1 Charter + policy
- [x] 8.2 Safety numbers v3 + local QR
- [x] 8.3 Prekey API + libsignal **0.96.2** pinned
- [x] 8.4 X3DH session (1:1 Android)
- [x] 8.5 Double Ratchet `signal_v1` text (G9 closed)
- [x] 8.6 Dual-read RSA + SIG/RSA UI labels
- [x] 8.7 WebRTC 1:1 signaling encrypted (G6 closed)
- [x] 8.8 Full gate + live integration proof (50 unit + 10 integration + 37 proof checks)
- [x] 8.9 Signal **1:1 attachments** (Android — AES file + ratchet key envelope)
- [x] 8.11 **Group Sender Keys** `signal_group_v1` (Android — SKDM fan-out + type 7)
- [x] 8.13 Group **call signaling** encrypted via Sender Keys
- [x] 8.12 **Stories** `signal_status_v1` (Sender Keys + contact SKDM fan-out)
- [x] 8.10 Signal on **Web** — **retired** (no browser WASM; desktop libsignal = Engine 10)

**Charter:** `memory/SIGNAL_PROTOCOL_CHARTER.md`

### Engine 10 — Desktop clients ✅
- [x] 10.1 Desktop charter + policy (`memory/DESKTOP_CLIENT_CHARTER.md`)
- [x] 10.2 Electron + libsignal Node bridge (IPC parity with Android plugin)
- [x] 10.3 Windows installer (`SSC-BUILD-DESKTOP-WIN.bat` → NSIS `.exe`)
- [x] 10.4 Mac build config (`yarn desktop:build:mac` on macOS)
- [x] 10.5 Engine 10 gate + platform wiring

**Charter:** `memory/DESKTOP_CLIENT_CHARTER.md`

### Engine 6 — Push / own-metal ✅ (evaluation)
- [x] 6.1 Push path evaluation — keep FCM + VAPID; self-host deferred
- [x] 6.2 Own-metal Mongo evaluation — keep Atlas; deferred post-investors
- [ ] 6.3 Own-metal migration runbook (post-investors)

**Charter:** `memory/ENGINE_6_CHARTER.md`

### Engine 9 — Translation privacy ✅
- [x] 9.1 On-device translation policy + unified client
- [x] 9.2 ML Kit Capacitor plugin (Android `SscTranslate`)
- [x] 9.3 Message UI uses on-device translate (no server plaintext on APK)
- [x] 9.4 Engine 9 gate + M5 closed

---

## Signal coverage — whole app plan

**Your question:** Signal was added — shouldn't the **whole app** use it?

**Answer:** Yes, that is the **target**. Engine 8 v1 deliberately shipped **incrementally** so nothing broke. Current truth:

| Surface | Android | Windows/Mac desktop | Browser (dev only) |
|---------|---------|---------------------|-------------------|
| 1:1 text | ✅ `signal_v1` | ✅ `signal_v1` | Legacy RSA (not product) |
| 1:1 call signaling | ✅ encrypted | ✅ encrypted | Legacy |
| 1:1 attachments | ✅ `signal_v1` | ✅ `signal_v1` | Legacy RSA |
| Group messages | ✅ `signal_group_v1` | ✅ `signal_group_v1` | Legacy RSA |
| Group call signaling | ✅ encrypted | ✅ encrypted | Legacy |
| Stories / statuses | ✅ `signal_status_v1` | ✅ `signal_status_v1` | Legacy RSA |
| Account unlock | RSA vault (PBKDF2) | Same | Same |

**Product surfaces:** Android APK · Windows `.exe` · Mac `.dmg` (build on Mac) · iOS deferred.

**P1 security — complete:**
1. [x] **Unified identity** — libsignal curve primary (`memory/UNIFIED_IDENTITY_CHARTER.md`)
2. [x] **Contacts graph privacy** — blind seals + encrypted rosters (`memory/CONTACT_GRAPH_PRIVACY_CHARTER.md`)

Details: `memory/SECURITY_MODEL.md`

---

## Product features (MVP)

| Feature | Status |
|---------|--------|
| 1:1 + group chat | ✅ |
| E2E files (RSA envelope) | ✅ |
| Voice/video 1:1 + group (mesh up to **8**) | ✅ |
| Stories 24h | ✅ |
| Contacts + friend requests | ✅ |
| 2FA TOTP + backup codes | ✅ |
| Panic wipe (keeps account + friends) | ✅ |
| Push FCM + Web VAPID | ✅ |
| Capacitor Android APK | ✅ |
| Windows desktop (Electron + libsignal) | ✅ |
| Mac desktop (`.dmg` on macOS) | ✅ config · build on Mac |
| Web / PWA in browser | ✅ **Retired as product** — download landing only (`InstalledClientGate`) |
| Google OAuth (web + native) | ✅ configured |
| Translation | ✅ On-device (Android ML Kit); server off by default |
| iOS app | ⬜ Deferred · scaffold exists (`frontend/ios/`) |
| Custom domain + Turnstile | ⬜ ~28 Jun 2026 |
| Play Store public | ⬜ Listing (AGPL review ✅) |
| TURN self-host (off-LAN calls) | ⬜ Credentials exist; verify on phone |

---

## Open gaps (honest)

| ID | Item | Priority | Notes |
|----|------|----------|-------|
| S3 | Native session lost on force-close | **P0** (founder retest) | Engine 5 doc accepted tradeoff — founder expects stay-logged-in unless panic wipe |
| QA-1 | Founder two-device QA backlog | **P0–P2** | See **Founder QA report** below (24 Jun 2026) |
| — | iOS libsignal + App Store | Deferred | — |

**Closed:** G6, G9, C8, M4, M5 · HIGH audit (OAuth, deep links, dev/prod guards) · Android + desktop Google OAuth redirect wiring

---

## Founder QA report — two-device session (24 Jun 2026)

**Devices:** Windows desktop (`smashmaxxx` / `SSC-Setup-1.0.4.exe`) ↔ Android phone (`dots` / APK v1.0.3–1.0.4)  
**API:** Production Cloud Run · accounts linked via Google OAuth  
**In progress:** 24h retention — conversation left open to verify server + client TTL deletes message lines

### What worked ✅

| Area | Result |
|------|--------|
| Google OAuth | Phone + PC login complete (after `chat.ssc.secure://app` + desktop protocol fix) |
| Friend request | `smashmaxxx` → `dots` request delivered (visible after app restart on phone) |
| Cross-device chat | 1:1 thread opens; messages deliver both ways |
| PC → phone video | Call connects; laptop camera visible on phone |
| PC → phone voice call | Call initiates (audio one-way / permission issues on phone) |
| Delete contact | Confirm dialog works (Cancel / Confirm) |
| Google avatar | Profile photo from Google `picture` URL (no gallery access) |
| Settings (partial) | Signal identity LISTO, vault ABIERTO, 2FA OFF, panic copy present |

### P0 — Broken or blocking (fix before wider testers)

| # | Issue | Expected behavior |
|---|--------|-------------------|
| P0-1 | **Friend request not live** — pending badge / Pending tab empty until force-close + reopen | WebSocket or push updates contacts in real time while app is open |
| P0-2 | **Session lost on force-close** (phone) — must Google-login again | Stay logged in across kill/restart; logout only explicit or panic wipe |
| P0-3 | **Android mic + camera permissions** — voice notes, answer/place calls, video calls fail on phone | Runtime permission prompts; calls and voice notes usable |
| P0-4 | **Calls one-way / no audio** — PC→phone video shows camera; no ringtone on laptop; phone cannot answer; no call audio | Full duplex audio; incoming ring UI + sound both sides |
| P0-5 | **Desktop voice note** — mic turns red but attachment empty (only RSA timestamp metadata) | Record, upload, play encrypted voice note on peer |
| P0-6 | **Screenshot / image in chat** — received on PC as flat screenshot, not openable/zoomable/downloadable | Tap to preview, zoom, save (Signal/RSA attachment flow) |
| P0-7 | **Block + Mute** on PC — no effect | Block hides chat + rejects; mute silences notifications |
| P0-8 | **Create group** — pick member works (1→2) but **Create** does nothing | Named group created; members synced |
| P0-9 | **Google OAuth leftover window** (phone) — browser/WebView stays open after sign-in | Auto-close OAuth surface on return to app |
| P0-10 | **Android back stack “folder” bug** — in-chat **top-left `<`** → chat list ✅; on list, **Samsung system back** (gesture/nav) → **reopens same chat** ❌; repeated backs needed to fully exit; rapid back in chat can hit login | Single stack: system back on list = exit chat layer (or app minimize), never re-enter thread; use `replace` navigation + Capacitor `backButton` handler; no duplicate `/chat` ↔ `/chat/:id` history entries |

### P1 — UX / product (VIP polish)

| # | Issue | Target |
|---|--------|--------|
| P1-1 | **Legacy / upgrade banners in chat** — “legacy encryption”, “contact has not upgraded”, “E2E channel established — say hello” | Hide from default UI; optional debug/settings only. Peers should negotiate Signal silently |
| P1-2 | **Why “upgrade”?** — User expects whole app E2E | Copy + behavior: auto bootstrap Signal on installed clients; no yellow scolding in thread |
| P1-3 | **New chat / group picker** — must type username; should list **accepted contacts** with checkboxes | WhatsApp-style: pick from contacts, optional search |
| P1-4 | **Group naming** — multiple groups indistinguishable | Require group title (or default “Alice, Bob +2”) |
| P1-5 | **Non-mutual contact** — search finds user but messaging/calls/files should be blocked | Friendly auto-message: “Request sent — waiting for acceptance” (no plaintext spam) |
| P1-6 | **Chat header menu (⋮)** — opens behind message bubbles (z-index) | Menu above composer; readable |
| P1-7 | **Settings pro pass** — desktop shows `Versión 1.0.0` (stale); layout feels cheap | Match build version (1.0.4); tighten sections (Profile / Security / Preferences / About); pro patterns from Signal/WhatsApp |
| P1-8 | **Vault unlock prompt** after re-login | Only when sending/decrypting; not on every entry |
| P1-9 | **Email/password on Google-only account** — “invalid credentials” | Clear error: “Use Google sign-in for this account” |
| P1-10 | **Profile tap** (avatar / name in chat & list) | Optional v2: contact profile sheet (mute, block, safety number) — defer if not MVP |

### P2 — Nice to have

| # | Item |
|---|------|
| P2-1 | Incoming call ringtone / vibration on desktop |
| P2-2 | Unified back: system back on chat list should minimize/exit app (WhatsApp-style), not reopen last thread — see P0-10 |
| P2-3 | Onboarding coach copy trim — less floating instructional text in threads |

### Engineering notes (for implementers)

| Topic | Explanation |
|-------|-------------|
| **Legacy RSA label** | Engine 8.6 dual-read: messages use `legacy_rsa` until Signal X3DH session exists between **both** installed peers. Not a user “upgrade” — auto `bootstrapSignalIdentity` should clear this without UI noise |
| **Session after kill** | Native clients store JWT in memory (Engine 5). Force-stop clears it — if founder wants persistence, need secure native storage (Keychain/Keystore) without weakening panic wipe |
| **Google vs password** | Google accounts have `auth_provider=google`, no `password_hash` — email login correctly fails; UX must say so |
| **Real-time contacts** | Likely missing WS event handler for `friend-request` / roster refresh on phone while foreground |
| **Back stack** | `leaveChat()` calls `navigate('/chat')` (push) after `navigate('/chat/:id')` (push) — browser history becomes `/chat` → `/chat/xyz` → `/chat`; Android system back pops into `/chat/xyz`. Fix: `replace: true` on leave + `@capacitor/app` `backButton` listener |

---

## Testing & deploy (founder — locked)

| Mode | Use |
|------|-----|
| LAN / localhost | Founder laptop only |
| **Firebase App Distribution** | Real testers — production API URL in APK |
| **Cloud Run HTTPS** | `https://ssc-api-4jp3wuccwa-ew.a.run.app` |
| LAN IP | **Never** give to testers |

```powershell
cd C:\Users\smash\SSC-main\backend
.\venv\Scripts\python.exe scripts\run_engine8_gate.py
.\venv\Scripts\python.exe scripts\run_engine9_gate.py
```

---

## Remaining work (priority order)

### P0 — Before wider testers
- [x] HTTPS production API (Cloud Run)
- [x] Google OAuth + Cloud Run redirect URI
- [x] APK bakes Cloud Run URL (`yarn cap:sync` / `SSC-BUILD-APK.bat`)
- [x] **Redeploy** production API (revision `ssc-api-00012-bbc` · oauth_code + native/desktop redirects · 24 Jun 2026)
- [x] HIGH audit batch — oauth_code exchange, deep links, session recovery, dev/prod guards (`241ff6c`)
- [x] Android OAuth redirect `chat.ssc.secure://app` (fix localhost ERR_CONNECTION_REFUSED · `4501fa7`)
- [x] Desktop OAuth — protocol register + in-window intercept (`d86a0bd` · `SSC-Setup-1.0.4.exe`)
- [x] DB wipe + dev `ssc-dev` split; pytest **538 passed**; TTL indexes on dev DB
- [ ] Custom domain + Turnstile (~28 Jun)
- [x] Sync PRD (`memory/PRD.md` — 24 Jun 2026, incl. deploy checklist)
- [x] Automated smoke: `e2e_smoke.py` + Engine 1–5/8/9 gates + production `/api/health` (24 Jun 2026)
- [x] Settings Security hub + 2FA wired (`SettingsModal` + `TwoFAModal`)
- [x] First-run onboarding coach (3 steps)
- [x] In-app UI/UX pass — avatars, pro Settings, ConfirmDialog, smart scroll, file upload gates, mobile message search, i18n es/ro (24 Jun 2026)
- [x] `reset_tester_accounts.py` — purge `e2e*`, `testfriend`, `@ssc.dev` (preserve `raul1988`)
- [x] Rebuild APK v1.0.4 (build 6) + Windows `SSC-Setup-1.0.4.exe` (24 Jun 2026)
- [x] Founder two-device smoke **started** — smashmaxxx ↔ dots: chat ✅ · requests (delayed) ✅ · calls partial ⚠️
- [ ] **P0 QA backlog** — see Founder QA report (permissions, real-time contacts, session persist, calls, attachments, block/mute, groups)
- [ ] Two-phone smoke: Signal **without** legacy banners + working mic/camera + on-device translate
- [ ] TURN verification on cellular/Wi‑Fi mix (founder manual — same session as two-phone)
- [ ] **Retention proof** — founder watching 24h timer on active smashmaxxx ↔ dots thread (in progress)

### P1 — Product / security
- [x] Engine 8.9: Signal attachments (1:1 Android)
- [x] Engine 8.11: Group Sender Keys
- [x] Engine 8.12: Stories Signal encryption
- [x] Engine 8.13: Group call signaling encryption
- [x] Engine 8.10: Signal on Web — **retired** (Engine 10 desktop instead)
- [x] Engine 9: on-device translation (M5)
- [x] Engine 10: Windows + Mac desktop (`memory/DESKTOP_CLIENT_CHARTER.md`)
- [x] Unified identity (libsignal curve primary · prekeys required · `run_unified_identity_gate.py`)
- [x] Web/PWA product retired — browser shows download-only landing; chat/register gated
- [x] Contacts graph privacy (blind seals + encrypted rosters · `run_contacts_graph_gate.py`)
- [x] AGPL legal review (`memory/AGPL_COMPLIANCE.md`, `LICENSE`, in-app source offer)
- [x] Group video cap **8** (mesh; SFU for 9+ deferred to domain ~28 Jun)

### P2 — Scale & polish
- [x] Engine 6 evaluation (push + own-metal — charter + gate; migration deferred)
- [x] WebSocket Redis pub-sub (multi-worker — Redis fan-out + global online set)
- [x] SFU Phase A — charter + `/api/config` + mesh cap enforcement (mediasoup deploy = Phase B)
- [x] iOS Capacitor scaffold (`cap add ios` + charter; App Store build deferred — needs Mac)
- [x] 2FA backup codes (10 codes on setup, login fallback, regenerate in UI)
- [x] Invite links — **retired** (username search + friend requests sufficient)
- [x] Frontend automated tests (`yarn test:ci` — 13 tests, 4 suites)
- [x] Remove dead shadcn `components/ui` scaffold

---

## Test health (verified 24 Jun 2026)

| Metric | Value |
|--------|-------|
| pytest collected | **538+** |
| pytest result | **538 passed**, 1 skipped, 0 failed (24 Jun 2026 · local `ssc-dev` + backend on :8000) |
| Engine 1–5 gates | **PASS** |
| Engine 8 gate | **PASS** (54 unit + 10 integration + proof through 8.12) |
| Engine 9 gate | **PASS** |
| `e2e_smoke.py` | **PASS** (health, contacts, messages, files, statuses, panic wipe) |
| Production `/api/health` | **PASS** (`env=production`, mongo + redis ok) |
| WS fan-out | Redis pub-sub when `REDIS_URL` set · `ws_fanout` in `/api/health` |
| Frontend tests | **29 passed** (`yarn test:ci`) |
| AGPL gate | **PASS** (`run_agpl_gate.py`) |
| Engine 10 gate | **PASS** (`run_engine10_gate.py`) |
| Unified identity gate | **PASS** (`run_unified_identity_gate.py`) |
| Contacts graph gate | **PASS** (`run_contacts_graph_gate.py`) |

---

## Changelog

| Date | Milestone |
|------|-----------|
| 2026-06-17 | MVP iterations 1–3 |
| 2026-06-23 | Engines 1–5 complete |
| 2026-06-23 | Engine 8 complete (libsignal 0.96.2) |
| 2026-06-23 | Engine 8.9 — Signal 1:1 attachments (Android) |
| 2026-06-23 | Engine 8.11 — Group Sender Keys `signal_group_v1` |
| 2026-06-23 | Engine 8.12 — Stories `signal_status_v1` |
| 2026-06-23 | Engine 8.13 — Group call signaling encrypted |
| 2026-06-23 | Single roadmap file — retired duplicate Desktop roadmaps |
| 2026-06-23 | Cloud Run production API live; OAuth on Cloud Run redirect |
| 2026-06-23 | Engine 9 — on-device translation (ML Kit Android); M5 closed |
| 2026-06-23 | `yarn cap:sync` rebuild — Engine 9 + Signal 8.9–8.13 baked into APK |
| 2026-06-24 | Test drift fixed (3 policy assertions for 8.9–8.12 + Firebase App Distribution) |
| 2026-06-24 | `e2e_smoke.py` panic-wipe check aligned with session revocation; smoke green |
| 2026-06-24 | All Engine 1–5/8/9 gates pass; pytest 476/476 (1 skipped) |
| 2026-06-24 | Roadmap cleanup: Engine 7 removed, 2FA backups marked done, invite links retired |
| 2026-06-24 | Invite links removed from codebase (username search + friend requests only) |
| 2026-06-24 | PRD synced to current architecture (Signal Android, Engine 9, production deploy) |
| 2026-06-24 | Frontend automated tests — 13 tests (i18n, presence, session footprint, Landing) |
| 2026-06-24 | Engine 6 evaluation — push/own-metal charter + policy gate (6.1–6.2) |
| 2026-06-24 | WebSocket Redis pub-sub — multi-worker fan-out + push offline fix |
| 2026-06-24 | SFU Phase A — mediasoup selected; config + mesh cap; deploy deferred |
| 2026-06-24 | iOS Capacitor scaffold — `frontend/ios/` + IOS_CAPACITOR_CHARTER.md |
| 2026-06-24 | AGPL legal review — LICENSE, THIRD_PARTY_NOTICES, compliance doc, in-app source offer, gate |
| 2026-06-24 | Installed-clients-only product strategy — Web/PWA retired as product surface |
| 2026-06-24 | Engine 10 — Electron desktop + libsignal (Windows NSIS · Mac dmg config) |
| 2026-06-24 | Group video mesh cap raised to **8**; contacts privacy + unified identity locked P1 |
| 2026-06-24 | Web/PWA chat retired — download landing + `InstalledClientGate` |
| 2026-06-24 | Unified identity — `identity_primary` signal_v1, prekeys required on installed clients |
| 2026-06-24 | Contact graph privacy — blind seals, encrypted rosters, M4 closed |
| 2026-06-24 | UX gaps — Settings Security + 2FA, onboarding coach, PRD sync, Engine 3 proof fix |
| 2026-06-24 | In-app UI/UX pass — Avatar, Settings profile/avatar, ConfirmDialog, scroll/upload/call wiring, es/ro i18n |
| 2026-06-24 | Cloud Run redeploy `ssc-api-00006-qsf` + APK + Windows installer rebuilt for Firebase distribution |
| 2026-06-24 | HIGH audit fixes — oauth_code, deep links, dev/prod guards; DB wipe; `241ff6c` |
| 2026-06-24 | Android OAuth — `chat.ssc.secure://app` replaces broken `https://localhost` redirect · APK v1.0.4 |
| 2026-06-24 | Desktop OAuth — Electron protocol + navigation intercept · `SSC-Setup-1.0.4.exe` |
| 2026-06-24 | Founder QA — smashmaxxx ↔ dots two-device session documented (P0–P2 backlog in roadmap) |
| 2026-06-24 | QA note — Android back stack “folder” behavior (in-app `<` vs system back) documented as P0-10 |