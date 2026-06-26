# SSC Roadmap — single source of truth

**Updated:** 2026-06-26 (Cloud Run redeploy + TASK I.7 complete)
**Repo:** `C:\Users\smash\SSC-main`
**Rule:** After every engine step, feature, or deploy — update **this file only**. Do not maintain parallel roadmaps.

**Companion docs:** `memory/SECURITY_MODEL.md` · `memory/UNIFIED_IDENTITY_CHARTER.md` · `memory/PRD.md`
**Gate commands:** `backend/scripts/run_engineN_gate.py`

---

## How to use this doc

1. **Done** — Engines 1–5, 8–10, 9 + TASK A–F code + **v1.0.5 rebuild** (see §Foundation, §Release v1.0.5).
2. **Next** — **Founder QA matrix (TASK J)** on smashmaxxx ↔ dots with v1.0.5 builds.
3. **Then** — TASK H (UX polish) · TASK I (domain, Turnstile, TURN) when funded.
4. **Release gate** — TASK J green before Firebase testers beyond founder.

**Current builds:** APK **v1.0.7** · Windows **`SSC-Setup-1.0.7.exe`** · API **`ssc-api-00016-mgl`**
**Last deploy:** 26 Jun 2026 — Cloud Run redeploy after TASK H backend auth updates
**Next task:** TASK J — founder QA matrix (all A–F items on real devices)

---

## Live infrastructure (verified 26 Jun 2026)

| Service | URL / status | Notes |
|---------|----------------|-------|
| **Production API** | `https://ssc-api-4jp3wuccwa-ew.a.run.app` | Cloud Run **`ssc-api-00016-mgl`** · `env=production` · mongo ✅ · redis ✅ |
| **Firebase project** | `super-chat-b0992` | App Distribution, FCM push, Hosting (`super-chat-b0992.web.app`) |
| **MongoDB** | Atlas `ssc` cluster | Network: allow Cloud Run (0.0.0.0/0) |
| **Redis** | Upstash (production) | Required for `ENV=production` |
| **APK API URL** | Cloud Run (baked in build) | `frontend/.env.production.local` |
| **Google OAuth** | ✅ Wired (phone + desktop) | Android `chat.ssc.secure://app` · desktop `chat.ssc.secure.desktop://` |
| **Release builds** | **v1.0.7** | APK `Desktop\SSC\APK\SSC-app-release.apk` · Win `Desktop\SSC\SSC-Setup-1.0.7.exe` |
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
| 5 Session hardening | ✅ | HttpOnly web · native JWT + encrypted device wrap (TASK B) · Redis revocation |
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

### Test health (24 Jun 2026 — post-audit)

| Metric | Value |
|--------|-------|
| pytest | **543 passed**, 1 failed (live API integration), 1 skipped |
| Engine 1–5, 8, 9, 10 gates | **PASS** |
| Unified identity + contacts graph gates | **PASS** |
| Production `/api/health` | **PASS** (`mongo` ok · `redis` ok · `ws_fanout` redis) |
| Frontend `yarn test:ci` | **67 passed** |
| APK release build | **PASS** (v1.0.5 build 7) |
| Desktop NSIS build | **PASS** (`SSC-Setup-1.0.5.exe`) |

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

## Release v1.0.5 — pre-deploy audit (24 Jun 2026)

### Blockers found & fixed before deploy

| Issue | Severity | Fix |
|-------|----------|-----|
| `CreateGroupModal` referenced `useRef` without import → **crash on New Group** | CRITICAL | Removed dead `debRef` (`a119ce9`) |
| `GET /contacts` hid blocked users (`are_contacts` false) → **unblock impossible, sidebar filter broken** | CRITICAL | List blocked roster entries when `blocked_by_me` (`contacts.py`) |
| Stale policy tests (VERIFY UI, panic order, roadmap Engine 10) | MEDIUM | Tests aligned with TASK A |
| Settings showed version **1.0.0** | MEDIUM | `REACT_APP_SSC_VERSION=1.0.5` in production env |
| Block/mute no WS sync | MEDIUM | `contacts-changed` on block/mute endpoints |

### Confirmed OK (scan)

- No `setUnlockOpen` dead refs · API paths match frontend · Signal + RSA dual-read intact
- TASK C WS contact events · TASK D permissions plugin registered · TASK E attachment pipeline wired
- Panic orchestrator: client wipe **before** server call (correct order)
- Production health: mongo + redis + redis WS fanout

### Known issues still open (honest)

| Issue | Impact |
|-------|--------|
| **Founder QA not run** on v1.0.5 | All A–F code is shipped but **unverified on smashmaxxx ↔ dots** |
| **TURN not verified** off-LAN | Video/voice may fail on cellular ↔ Wi‑Fi (TASK I.3) |
| **Kotlin/R8 metadata warnings** on APK build | Build succeeds; watch for runtime edge cases on older Android |
| **No code signing** on Windows installer | SmartScreen will warn |
| **iOS** | Not shipped (TASK K) |
| **Dual RSA legacy path** still internal | Migration incomplete; installed clients use Signal |
| **Dead components** | `VerifyHandshakeModal.jsx`, `EncryptionModeBadge.jsx` unused (kept for advanced Settings later) |
| **eslint** | `ChatHome` back-handler missing deps (cosmetic) |
| **Integration test** `test_ssc_iteration2` | Requires live API + test accounts; run manually |

---

## Health check — pure reality (24 Jun 2026)

### Engineering health: **B+** (for a solo-founder MVP)

| Layer | Grade | Notes |
|-------|-------|-------|
| Automated tests | **A-** | 544 backend + 67 frontend; integration tests need live API |
| Security architecture | **A-** | Signal + retention + blind contacts graph; no third-party audit |
| Production infra | **B** | Cloud Run + Atlas + Upstash works; single region; no TURN yet |
| Client stability | **B-** | Builds pass; real-device QA pending |
| UX polish | **C** | Functional, not WhatsApp-smooth |
| Scale readiness | **D** | Fine for dozens of users; not millions |

### vs big giants (% feature parity — honest)

*Not “how good is crypto” — how close is the **product** a normal user would switch for.*

| Competitor | Overall parity | Where SSC is stronger | Where SSC is far behind |
|------------|----------------|----------------------|-------------------------|
| **WhatsApp** | **~28%** | 24h retention default, panic wipe, blind server graph, no phone number required | Calls reliability, media polish, groups admin, iOS, scale, backup, stickers, channels, payments |
| **Telegram** | **~18%** | E2E on installed clients, retention policy | Cloud sync, bots, channels, search, desktop feature depth, speed at scale |
| **Signal** | **~42%** | Similar crypto story + retention + panic; contacts privacy seals | Call quality, UX maturity, safety numbers UX (hidden), iOS parity, audited reputation |
| **Messenger** | **~15%** | Privacy posture | Everything social + scale |

**SSC “privacy-first messaging core”** (installed Android + Windows, mutual contacts only): **~55–60%** of what Signal offers for daily 1:1 chat — **if** founder QA passes on v1.0.5.

**Bottom line:** SSC is a **real encrypted messenger MVP**, not a giant killer. Competitive edge is **policy** (24h TTL, minimal metadata, panic, blind graph), not feature count.

---

## What’s done vs what’s left

### Shipped in code (TASK A–F) — needs founder retest on v1.0.5

| Task | Code | Founder device QA |
|------|------|-------------------|
| **A** Invisible security | ✅ | [ ] |
| **B** Session persist | ✅ | [ ] |
| **C** Live contacts / friend requests | ✅ | [ ] |
| **D** Permissions + calls | ✅ | [ ] |
| **E** Attachments / voice / images | ✅ | [ ] |
| **F** Block / mute / groups | ✅ | [ ] |
| **G** OAuth + Android back | ✅ | [ ] |

### Not started / deferred

| Task | Scope |
|------|-------|
| **H** UX polish (P1) | Contact picker, header z-index, Settings pro, Google-only error copy |
| **I** Infra | Custom domain, Turnstile, TURN, Play Store |
| **J** QA matrix | **← YOU ARE HERE** — run on smashmaxxx + dots |
| **K** Deferred | iOS, SFU, own-metal, email confirm |

---

## Suggestions (straight talk)

**Do now (before wider testers):**
1. Run full **TASK J matrix** on v1.0.5 — this is the real gate.
2. Test **cellular ↔ Wi‑Fi call** — if it fails, TURN is not optional for US↔UK.
3. Do **not** recreate smashmaxxx/dots accounts until retention timer check (per policy).

**Do soon (high ROI):**
1. **TASK H.5** — Google-only email error (reduces support noise).
2. **TASK H.3** — chat header menu z-index (Android annoyance).
3. Remove or wire **dead VERIFY/badge components** — reduces confusion for future devs.
4. **Code-sign** Windows installer when budget allows.

**Consider removing / deferring:**
1. **Group mesh video >4 people** — unreliable without SFU; cap at 4 until TASK K.
2. **Server translation** — keep on-device only; aligns with privacy story.
3. **Web/PWA product** — already retired; good, keep it dead.

**Do not pretend:**
1. SSC is production-ready for public launch — it is **founder + closed testers** ready after J passes.
2. Calls match WhatsApp — they do not until TURN + QA prove otherwise.
3. iOS “soon” — it is a multi-week project minimum.

---

## Execution plan — main tasks & subtasks

**Legend:** `[ ]` open · `[~]` in progress · `[x]` done

---

### TASK A — Invisible security (vault + crypto UX) · ✅ DONE (24 Jun 2026)

**Goal:** WhatsApp-like — crypto runs; user never manages keys or vault.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| A.1 | Remove **vault locked banner** from chat | `ChatHome.jsx` | [x] |
| A.2 | Replace vault/Signal rows with **Messages protected** in Settings | `SettingsModal.jsx` | [x] |
| A.3 | Login/register copy — “Sign in” / “Create account” (en/es/ro) | `i18n.js` | [x] |
| A.4 | **Email/password login** — silent auto-unlock + save device credential | `Login.jsx`, `AuthContext.jsx` | [x] |
| A.5 | **Google login** — auto-unlock via `vaultCredentialStore.js` (device AES wrap); saved at setup/register/login | `AuthContext.jsx`, `SetupUsername.jsx`, `Register.jsx` | [x] |
| A.6 | Remove **legacy / upgrade / E2E established** banners from chat | `ChatHome.jsx` | [x] |
| A.7 | Hide **VERIFY / QR** from chat header and mobile menu | `ChatHome.jsx` | [x] |
| A.8 | **Silent Signal bootstrap** on login + cold start | `AuthContext.jsx` | [x] |
| A.9 | Remove **SIG/RSA protocol labels** from messages | `Message.jsx` | [x] |
| A.10 | Founder retest: no crypto jargon; messages still E2E | smashmaxxx ↔ dots after rebuild | [ ] |

**Note:** Existing Google accounts created before this deploy have no device credential yet — one email/password login (or new setup) seeds auto-unlock on that device.

---

### TASK B — Session persistence (stay logged in) · ✅ DONE (24 Jun 2026)

**Goal:** Force-close app → reopen → still logged in. Logout only explicit or panic wipe.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| B.1 | Persist JWT as **AES device wrap** (`ssc_session_wrap_enc`) — never plaintext `ssc_token` | `nativeSessionStore.js`, `deviceWrapCrypto.js` | [x] |
| B.2 | `bootstrapSessionFromDevice()` before `/auth/me` on cold start | `AuthContext.jsx`, `sessionStore.js` | [x] |
| B.3 | Logout + panic clear encrypted wrap; 401 clears stale session | `clientFootprintOrchestrator.js`, `clearSessionToken` | [x] |
| B.4 | Policy docs updated (S3 gap closed) | `SESSION_HARDENING_CHARTER.md`, `CLIENT_FOOTPRINT_CHARTER.md`, `session_policy.py` | [x] |
| B.5 | Founder QA: force-stop Android → reopen → still in chat | dots device after rebuild | [ ] |

---

### TASK C — Real-time contacts & friend requests · ✅ DONE (24 Jun 2026)

**Goal:** Pending badge and roster update live while app is open.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| C.1 | WS events: `friend-request`, `friend-request-sent`, `friend-accepted`, `friend-rejected`, `contacts-changed` | `contact_realtime.py`, `contacts.py` | [x] |
| C.2 | Client refresh on WS + `ssc-contacts-refresh` event | `ChatHome.jsx`, `contactRealtime.js` | [x] |
| C.3 | FCM foreground/background → `dispatchContactsRefresh` | `native-push.js` | [x] |
| C.4 | Founder QA: send request PC → phone pending live | smashmaxxx → dots after rebuild | [ ] |
| C.5 | Founder QA: accept on phone → PC roster live | dots → smashmaxxx after rebuild | [ ] |

**Root cause fixed:** Push was skipped when WS connected but no WS event was sent — live app never refreshed roster.

---

### TASK D — Android permissions & calls · ✅ DONE (24 Jun 2026)

**Goal:** Mic, camera, notifications work; full duplex calls both ways.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| D.1 | Request **RECORD_AUDIO** + **CAMERA** at right moments (call, voice note, video) | `mediaPermissions.js`, `SscMediaPermissionsPlugin.java`, `AndroidManifest.xml` | [x] |
| D.2 | Handle permission denied → clear in-app message + Settings deep link | `mediaPermissions.js` toasts + `openAppSettings` | [x] |
| D.3 | Fix **incoming call UI** on Android — answer/decline visible | `ChatHome.jsx` overlay `z-[9999]`, safe-area, back → reject | [x] |
| D.4 | Fix **audio routing** — remote `<audio>` for voice calls; `getUserMedia` after grant | `callMedia.js`, `CallModal.jsx`, `GroupCallModal.jsx` | [x] |
| D.5 | **Ringtone** on callee (phone + desktop) | `callRingtone.js` Web Audio loop | [x] |
| D.6 | Desktop → phone **video**: callee can answer; **audio** both directions | Permissions gate + duplex audio element | [x] |
| D.7 | QA matrix: voice call, video call, cancel, busy | smashmaxxx ↔ dots after rebuild | [ ] |

**Root cause fixed:** Android manifest lacked `RECORD_AUDIO`/`CAMERA`; voice calls had no remote `<audio>` element (one-way audio).

---

### TASK E — Attachments & media · ✅ DONE (24 Jun 2026)

**Goal:** Voice notes, images, files open, play, zoom, download.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| E.1 | **Voice note record** — fix empty upload (desktop mic red but no blob) | `voiceRecorder.js` timeslice + `requestData()` | [x] |
| E.2 | Voice note **playback** on peer (Signal + RSA paths) | `Message.jsx` decrypt + play controls + fallback download | [x] |
| E.3 | **Image preview** modal — tap to open, pinch/zoom, save | `ImagePreviewModal.jsx` | [x] |
| E.4 | Screenshot paste vs file attach — same encrypted attachment UX | `ChatHome.jsx` `onComposerPaste` → `attachFile` | [x] |
| E.5 | Plain file attach (non-image) — name, size, download | `EncryptedFileAttachment` + `formatFileSize` | [x] |
| E.6 | QA: PC ↔ phone image + voice note round-trip | smashmaxxx ↔ dots after rebuild | [ ] |

**Root cause fixed:** Desktop `MediaRecorder` without timeslice produced empty blobs; voice calls had no remote audio element (fixed in TASK D).

---

### TASK F — Chat actions & groups · ✅ DONE (24 Jun 2026)

**Goal:** Block, mute, group create work on all clients.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| F.1 | **Block** — API call + hide thread + reject inbound | `contactFilters.js`, `messages.py` block check, leave chat on block | [x] |
| F.2 | **Mute** — persist per-conversation; silence push | `toggleMute` toasts; sidebar muted badge; backend `is_muted_pair` (existing) | [x] |
| F.3 | **Create group** — fix Create button (API + navigation) | Contacts-only picker; min 1 member (2-person group); `conversations.py` | [x] |
| F.4 | **Group naming** (P1-4) — require title or auto “Alice, Bob +N” | `groupDisplayLabel.js` + optional local title in `groupLabels.js` | [x] |
| F.5 | QA: block/mute on PC + phone; create 2-member group; send message | smashmaxxx ↔ dots after rebuild | [ ] |

**Root cause fixed:** Group create required 3+ members; picker searched all users not contacts only.

---

### TASK G — OAuth & navigation polish · ✅ DONE (24 Jun 2026)

**Goal:** Clean OAuth return; Android back behaves like WhatsApp.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| G.1 | OAuth in **Capacitor Browser** + close on deep link / callback | `oauthBrowser.js`, `google-auth.js`, `GoogleAuthCallback.jsx` | [x] |
| G.2 | `leaveChat()` → `navigate('/chat', { replace: true })` | `chatNavigation.js`, `ChatHome.jsx` | [x] |
| G.3 | **`backButton`** listener — thread → list, list → minimize | `nativeBack.js`, `capacitor-init.js` | [x] |
| G.4 | Replace history when leaving thread; push only when entering | `chatNavigateOptions()` | [x] |
| G.5 | System back on chat list minimizes app; modals close first | `ChatHome.jsx` back handler | [x] |
| G.6 | Founder QA: Samsung gesture back — no reopen loop | dots device after rebuild | [ ] |

---

### TASK H — UX polish (P1 backlog)

**Goal:** VIP feel; fewer dead ends.

| ID | Subtask | Ref | Status |
|----|---------|-----|--------|
| H.1 | **Contact picker** for new chat/group — list accepted contacts + checkboxes | P1-3 | [x] |
| H.2 | **Non-mutual messaging** — block send; show “request pending” | P1-5 | [x] |
| H.3 | **Chat header menu z-index** — menu above bubbles | P1-6 | [x] |
| H.4 | **Settings pro pass** — real version 1.0.4+, sections Profile/Security/Preferences/About | P1-7 | [x] |
| H.5 | **Google-only account** — error “Use Google sign-in” not “invalid credentials” | P1-9 | [x] |
| H.6 | Trim **onboarding coach** floating text in threads | P2-3 | [x] |
| H.7 | **Profile tap** sheet (mute, block) — defer if not MVP | P1-10 | [ ] |
| H.8 | Desktop **incoming call ringtone** | P2-1 | [x] |

---

### TASK I — Infrastructure & release prep

| ID | Subtask | Target | Status |
|----|---------|--------|--------|
| I.1 | **Custom domain** + DNS for API / hosting | ~28 Jun 2026 | [ ] |
| I.2 | **Turnstile** captcha on production register/login | ~28 Jun 2026 | [ ] |
| I.3 | **TURN** verification off-LAN (cellular ↔ Wi‑Fi calls) | Founder manual | [ ] |
| I.4 | **Retention proof** — 24h delete on smashmaxxx ↔ dots thread | In progress | [~] |
| I.5 | Rebuild **APK + desktop** after TASK batches; bump version | Post-fix | [x] |
| I.6 | **Play Store** listing (AGPL review ✅) | Post-P0 | [ ] |
| I.7 | Redeploy Cloud Run when backend changes | Per deploy | [x] |

---

### TASK J — QA verification matrix (before wider testers)

Run on **smashmaxxx (Win)** + **dots (Android)** against production API.

| Area | Test | Depends on | Status |
|------|------|------------|--------|
| Auth | Google login both devices | — | [x] |
| Auth | Stay logged in after force-close | TASK B | [x] code · [ ] founder retest |
| Auth | Google-only email login shows friendly error | TASK H.5 | [ ] |
| Contacts | Friend request live (send + accept) | TASK C | [x] code · [ ] founder retest |
| Chat | 1:1 text real-time | — | [x] |
| Chat | No vault / legacy / upgrade UI | TASK A | [x] code · [ ] founder retest |
| Chat | Image + voice note + file | TASK E | [x] code · [ ] retest v1.0.5 |
| Chat | Block + mute | TASK F | [x] code · [ ] retest v1.0.5 |
| Groups | Create + name + message | TASK F | [x] code · [ ] retest v1.0.5 |
| Calls | Voice + video duplex + ring | TASK D | [x] code · [ ] retest v1.0.5 |
| Stories | Post + 24h expiry | — | [ ] |
| Security | Panic wipe (data gone, account remains) | — | [ ] |
| Security | 2FA enable + login | — | [ ] |
| Push | Message + friend request when backgrounded | TASK C | [ ] |
| Translate | On-device Android (different languages) | — | [ ] |
| Retention | Messages gone after 24h | TASK I.4 | [~] |
| Nav | Android system back correct | TASK G | [x] code · [ ] founder retest |
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

### Broken → mapped to tasks (code status after v1.0.5)

| Issue | Task | Code | Retest v1.0.5 |
|-------|------|------|---------------|
| P0-1 Friend request not live | C | ✅ | [ ] |
| P0-2 Session lost on force-close | B | ✅ | [ ] |
| P0-3 Android mic/camera permissions | D | ✅ | [ ] |
| P0-4 Calls one-way / no audio / no ring | D | ✅ | [ ] |
| P0-5 Desktop voice note empty | E | ✅ | [ ] |
| P0-6 Images not previewable | E | ✅ | [ ] |
| P0-7 Block + mute broken on PC | F | ✅ | [ ] |
| P0-8 Create group broken | F | ✅ | [ ] |
| P0-9 OAuth window stays open | G | ✅ | [ ] |
| P0-10 Android back “folder” bug | G | ✅ | [ ] |
| P1-1 Legacy/upgrade banners | A | ✅ | [ ] |
| P1-2 VERIFY/QR in chat | A | ✅ | [ ] |
| P1-8 Vault prompt on re-login | A | ✅ | [ ] |
| P1-3–P1-10 UX polish | H | — | open |

---

## Engineering notes

| Topic | Explanation |
|-------|-------------|
| **Vault** | RSA private key wrapped with user password (`encrypted_private_key` + `pk_salt`). Unlock = decrypt to memory only (`AuthContext.unlockPrivateKey`). **Not** the same as Signal keys. Policy: invisible to users. |
| **Signal** | libsignal on device — primary E2E for installed clients. `ensurePreKeysUploaded()` on login. |
| **Legacy RSA** | Dual-read internal fallback. No user-facing “upgrade”. |
| **Google vs password** | Google = session; SSC password from finish-setup = vault wrap. Email login on Google-only account must fail with clear copy. |
| **Session** | Memory at runtime + `ssc_session_wrap_enc` (AES device wrap). Survives force-close; logout/panic/401 clear it. Never plaintext `ssc_token`. |
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
| 2026-06-24 | **TASK A complete** — invisible vault/crypto UX; `vaultCredentialStore.js`; frontend 32 tests pass |
| 2026-06-24 | **TASK B complete** — encrypted session persist; S3 gap closed; frontend 36 tests pass |
| 2026-06-24 | **TASK C complete** — friend-request WS events + live roster refresh; frontend 38 tests |
| 2026-06-24 | **TASK G complete** — OAuth Browser + Android back stack; frontend 43 tests |
| 2026-06-26 | Retention policy surfaced in chat header + Settings security (`Auto-delete in {hours}h`) |
| 2026-06-26 | **TASK H.1 complete** — new-chat modal now shows accepted contacts picker before username search |
| 2026-06-26 | **TASK H.2 complete** — non-mutual conversations now block composer actions and show request-pending hint |
| 2026-06-26 | **TASK H.3 complete** — chat header and mobile menu z-index raised above chat bubbles |
| 2026-06-26 | **TASK H.4 complete** — Settings now has explicit About section with version/platform and open-source details |
| 2026-06-26 | **TASK H.5 complete** — Google-only accounts now return/display friendly "Use Continue with Google" login guidance |
| 2026-06-26 | **TASK H.6 complete** — onboarding coach now opens from chat-list flow and auto-closes in active threads |
| 2026-06-26 | **TASK H.8 complete** — verified desktop incoming ringtone wiring (`callRingtone.js` + incoming-call state in chat) |
| 2026-06-26 | **TASK I.5 complete** — Windows desktop installer + Android APK/AAB rebuilt (`SSC-Setup-1.0.7.exe`, `SSC-app-release.apk`, `SSC-app-release.aab`) |
| 2026-06-26 | **TASK I.7 complete** — Cloud Run redeployed to revision `ssc-api-00016-mgl` (`https://ssc-api-4jp3wuccwa-ew.a.run.app`) |
| 2026-06-24 | **TASK D complete** — permissions, duplex audio, ringtone; frontend 55 tests |
| 2026-06-24 | **TASK E complete** — voice/images/files; frontend 62 tests |
| 2026-06-24 | **TASK F complete** — block/mute/groups; frontend 67 tests |
| 2026-06-24 | **Pre-deploy audit** — block roster + group modal crash fixed |
| 2026-06-24 | **v1.0.5 deploy** — API `ssc-api-00013-6dd` + APK build 7 + `SSC-Setup-1.0.5.exe` |