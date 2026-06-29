# SSC Roadmap — single source of truth

**Updated:** 2026-06-29 (TASK Q expansion wave · v1.0.12 · Q.21 video messages)
**Repo:** `C:\Users\smash\SSC-main` · **GitHub:** https://github.com/raullavita/SSC (public, AGPL-3.0)
**Rule:** After every engine step, feature, or deploy — update **this file only**. Do not maintain parallel roadmaps.

**Companion docs:** `memory/SECURITY_MODEL.md` · `memory/PRODUCT_BLUEPRINT.md` · `memory/UNIFIED_IDENTITY_CHARTER.md` · `memory/PRD.md`
**Public site:** `https://www.supersecurechat.com` (Firebase Hosting — construction gate)
**Gate commands:** `backend/scripts/run_engineN_gate.py`

---

## How to use this doc

1. **Done** — Engines 1–5, 8–10, 9 + TASK A–G + TASK L + TASK M/N + desktop translation (`4a949af`) + **public repo**.
2. **Now** — **TASK Q expansion wave** (strict serial order below). **One subtask at a time** — next starts only when previous is `[x]`, CI green, and nothing regressed.
3. **Open help issues** — **#2** desktop build docs · **#4** WebRTC signaling review (**shwetaj2820**).
4. **Before closed-beta testers** — finish **Q.1–Q.4** (web + language + layout + auto-update) then resume **TASK J** device matrix on each milestone build.
5. **Not doing** — QR add-friend · QR safety verify · phone contact-card share · group invite links · call screen-share (v1) · server plaintext translation · public GitHub Release binaries (unless policy changes).
6. **Pen test** — free/low-cost path in **Q.55** (CodeQL + OWASP ZAP CI first; MOSS / university / disclose.io later).

**Current local builds:** Windows **`SSC-Setup-1.0.12.exe`** · APK rebuild when founder cuts next tag
**GitHub release:** **v1.0.12** pre-release (source only — no `.exe` attached by design)
**Production API:** `https://api.supersecurechat.com` (founder deploy when ready — not tied to every git push)
**Last roadmap sync:** 27 Jun 2026 — removed stale Emergent branch; Dependabot majors ignored
**Next founder task:** TASK J (device QA) when you choose · else let #4/#2 contributors land

---

## Live infrastructure (verified 26 Jun 2026)

| Service | URL / status | Notes |
|---------|----------------|-------|
| **Production API** | `https://api.supersecurechat.com` | Cloud Run **`ssc-api-00022-jzs`** · `env=production` · mongo ✅ · redis ✅ |
| **Firebase project** | `super-chat-b0992` | App Distribution, FCM push, Hosting (`super-chat-b0992.web.app`) |
| **MongoDB** | Atlas `ssc` cluster | Network: allow Cloud Run (0.0.0.0/0) |
| **Redis** | Upstash (production) | Required for `ENV=production` |
| **APK API URL** | Cloud Run (baked in build) | `frontend/.env.production.local` |
| **Google OAuth** | ✅ Wired (phone + desktop) | Android `chat.ssc.secure://app` · desktop `chat.ssc.secure.desktop://` |
| **Release builds (founder local)** | **v1.0.12** | Win `Desktop\SSC\SSC-Setup-1.0.12.exe` · APK rebuild on demand |
| **GitHub** | public | CI + branch protection · Issues #2 #4 open · Discussions welcome pinned |
| **LAN dev** | ✅ Docker mongo + redis + local backend | Founder laptop only — never give LAN IP to testers |
| **Marketing domain** | `https://www.supersecurechat.com` | Firebase Hosting custom domain — live 26 Jun 2026 |
| **API custom domain** | `https://api.supersecurechat.com` | SSL live · OAuth redirect migrated (P.4–P.5) |

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
| 8 Signal Protocol | ✅ | libsignal 0.96.4 · PQXDH hybrid · 1:1, groups, stories, call signaling |
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

### Test health (27 Jun 2026 — GitHub CI on `main`)

| Metric | Value |
|--------|-------|
| GitHub CI | **Frontend tests** + **Backend tests** green on every `main` push |
| pytest (CI) | Full suite with live API + Mongo + Redis in Actions |
| Frontend `yarn test:ci` | **118 tests** (36 suites) incl. InstalledClientGate contributor tests |
| Engine 1–5, 8, 9, 10 gates | **PASS** (local gate scripts) |
| Production `/api/health` | **PASS** when API deployed (`mongo` · `redis`) |
| Desktop NSIS build | **PASS** (`SSC-Setup-1.0.12.exe` founder local) |

---

## Founder product policy (locked)

| Topic | Decision |
|-------|----------|
| **Vault** | **Security stays; users never see it.** RSA wrap remains on server; unlock is automatic on device. No “vault open/closed”, no unlock banners, no “Access your vault” copy. “Vault in concrete.” |
| **Messaging crypto** | **libsignal only** in user-facing story. Dual-read RSA stays internal until retired. |
| **Auto Signal** | Bootstrap X3DH + ratchet **silently** on installed clients at login / first contact. No “upgrade encryption” UI. |
| **QR / safety numbers** | Not MVP for remote users (US ↔ UK). Hide VERIFY from default chat; optional advanced Settings later. |
| **Email** | Google → `email_verified`, no extra link. Password register → activation link when `EMAIL_VERIFICATION_REQUIRED=true` (Q.36). |
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
| **Founder QA not run** on v1.0.7 | All A–F code shipped; **device matrix (TASK J) paused** per founder |
| ~~Turnstile disabled~~ | **Resolved** — P.1–P.2 live on web + API (APK/desktop rebuild pending) |
| **API on default Cloud Run URL** | OAuth/CORS trust gap until custom API domain (I.1) |
| **TURN not verified** off-LAN | Video/voice may fail on cellular ↔ Wi‑Fi (TASK I.3) |
| ~~Group call signaling cleartext~~ | **Resolved** — Q.34 / TASK O.2: group SDP/ICE must be `signal_v1` (server + clients reject legacy) |

| **No third-party security audit** | Do not claim “audited like Signal” publicly |
| **Retention not user-configurable** | ✅ Q.5 — per-user 1h–30d picker; group chats use shortest member timer |
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

### Active phase (26 Jun 2026 audit)

| Task | Scope | Status |
|------|-------|--------|
| **L.7** | Turnstile + API domain + TURN proof | [~] Turnstile + API domain done; TURN off-LAN pending P.6 |
| **M** | In-app UX polish (profile, Settings, feel) | [x] M.1–M.11 done (M.6 deferred v1.1) |
| **N** | Landing, legal, downloads, trust | [x] N.1–N.7 done; N.8 Play Store deferred |
| **O** | Crypto hardening (RSA retire, group signaling, keystore) | [ ] after M/N |
| **J** QA matrix | tester-win ↔ tester-android — resumes at **Q.64** (smoke at each wave milestone) | [ ] |
| **Q** Expansion wave | **63 subtasks** — serial order; **Q.58 done** → next **Q.59** | [~] Q.59 open |
| **I** Infra remainder | Folded into Q.61–Q.63 | [ ] |
| **K** Deferred items | SFU detail → Q.35 · iOS → Q.63 · email confirm → Q.36 | — |

---

## TASK Q — Expansion wave (founder directive · 28 Jun 2026)

**Goal:** Close competitive UX gaps without breaking shipped crypto, retention, or install-only policy.

### Execution law (non-negotiable)

1. Run **one Q subtask at a time** (Q.1 → Q.2 → …). No parallel feature branches unless hotfix.
2. Mark `[x]` only when: code merged · `yarn test:ci` + backend pytest green · founder smoke on Win + Android (or documented N/A) · roadmap line updated.
3. **Do not start Q.N+1** until Q.N is `[x]`.
4. If a subtask grows >3 days, split into Q.N.a / Q.N.b in this file — still serial.

### Founder decisions locked (28 Jun 2026)

| Topic | Decision |
|-------|----------|
| Public website | Open to everyone — **Under construction** copy; **no download buttons**; **no beta/tester signup** on site |
| Updates / stage | Public **Updates** section on first view (version, stage, changelog bullets) |
| QR | **No** add-friend QR · **No** safety-number QR verify — **email verification** for password accounts instead |
| Contact card | **No** phone vCard — optional later: “share my @username” in-chat only |
| Invite links | Stay **retired** (mutual contacts only) |
| Screen share | **No** in calls for v1 |
| Retention picker | User-selectable: **1h · 2h · 4h · 8h · 24h · 7d · 30d** (server-enforced TTL) |
| UI i18n | Keep **bundled locale packs** (text is tiny); **do not** pipe UI strings through cloud auto-translate (privacy + offline) |
| Message translate | Expand **on-device** pairs incrementally; Android ML Kit + desktop Transformers.js |
| Post-quantum | Upgrade when **libsignal** release train ships PQXDH on our pinned version — track upstream, no custom crypto |
| Desktop notifications | **Yes** — ship with Q.39–Q.41 after core chat UX |

### i18n note (answers “GTA 6 size” fear)

- UI strings ≈ **kilobytes per language**, not gigabytes. Safe to add es/ro/en first, then lazy-load extra JSON packs (`fr`, `de`, …) on demand.
- **Never** auto-translate the UI via Google/cloud for production — leaks product copy and breaks offline.
- Message translation stays **on-device**; adding UI languages ≠ adding ML models.

### Free / low-cost security audit path (Q.55)

| Step | Cost | Action |
|------|------|--------|
| 1 | $0 | Keep **CodeQL** + Dependabot + CI (done) |
| 2 | $0 | Add **OWASP ZAP** baseline scan in GitHub Actions on staging API |
| 3 | $0 | Publish **`SECURITY.md`** + `memory/SECURITY_MODEL.md` user summary | [x] Q.57 `/security` page |
| 4 | $0 | **`disclose.io`** responsible-disclosure policy | [x] Q.58 VDP + security.txt |
| 5 | $0 | **OWASP ASVS** self-checklist (founder + contributor) |
| 6 | Grant | **Mozilla MOSS** / NLnet — apply when OSS traction visible |
| 7 | $0 | **University capstone** pen-test project (contact CS departments) |
| Paid | $$$ | NCC / Cure53 / Trail of Bits — post-revenue |

---

### Q serial backlog (do in this exact order)

#### Wave 1 — Public face & device basics (low risk)

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 1 | **Q.1** | **Public website reopen** — remove password gate for visitors; hero = Under construction; hide APK/EXE/download CTAs; add **Updates / Stage** block (version, “private development”, no beta); keep Privacy/Terms; `REACT_APP_SITE_UNDER_CONSTRUCTION` semantics updated | Founder+git | [x] |
| 2 | **Q.2** | **OS language on first launch** — installed clients use `navigator.language` until user picks in Settings; persist choice | git | [x] |
| 3 | **Q.3** | **Tablet & large-screen layouts** — responsive chat split-pane (list + thread), safe areas; test landscape; allow auto-rotate on mobile (portrait default, landscape chat OK) | git | [x] |
| 4 | **Q.4** | **Auto-update** — Electron `electron-updater` + release feed; Android in-app update check (Firebase App Distribution / future Play Core) | Founder+git | [x] |

#### Wave 2 — Policy & privacy controls (backend + settings)

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 5 | **Q.5** | **Per-user retention timer** — 1h/2h/4h/8h/24h/7d/30d; Mongo TTL + UI in Settings; default 24h | git | [x] |
| 6 | **Q.6** | **Privacy toggles** — read receipts on/off · typing on/off · last seen granularity · profile photo visibility | git | [x] |

#### Wave 3 — Chat table stakes (highest daily-use ROI)

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 7 | **Q.7** | **Reply / quote message** | git | [x] |
| 8 | **Q.8** | **Delete for everyone / unsend** (within retention window) | git | [x] |
| 9 | **Q.9** | **Edit sent message** (time-limited, e.g. 15 min) | git | [x] |
| 10 | **Q.10** | **Forward message** (to mutual contacts / groups only) | git | [x] |
| 11 | **Q.11** | **Message reactions** | git | [x] |
| 12 | **Q.12** | **Pin chats** | git | [x] |
| 13 | **Q.13** | **Archive chats** | git | [x] |
| 14 | **Q.14** | **Search inside a chat** | git | [x] |
| 15 | **Q.15** | **Global message search** (respect retention; indexed ciphertext or client cache policy TBD) | git | [x] |

#### Wave 4 — Rich chat media & composer

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 16 | **Q.16** | **Link previews** (privacy-safe: client fetch or opt-in; no server plaintext) | git | [x] |
| 17 | **Q.17** | **@mentions in groups** | git | [x] |
| 18 | **Q.18** | **Rich text** (bold, italic, lists — lightweight markdown) | git | [x] |
| 19 | **Q.19** | **In-chat media gallery** | git | [x] |
| 20 | **Q.20** | **Voice note scrubber + playback speed** | git | [x] |
| 21 | **Q.21** | **Video messages** (short clip attach, not live call) | git | [x] |
| 22 | **Q.22** | **GIF / stickers** — start with bundled sticker pack + Tenor/Giphy opt-in (network toggle) | git | [x] |
| 23 | **Q.23** | **Polls** (group-only) | git | [x] |
| 24 | **Q.24** | **Location sharing** (one-shot map pin, E2E) — **no** contact-card share | git | [x] |

#### Wave 5 — Groups

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 25 | **Q.25** | **Admin roles & permissions** (owner/admin/member; who can post/add) | git | [x] |
| 26 | **Q.26** | **Group photo + description** | git | [x] |
| 27 | **Q.27** | **Member list polish** (admin badges, joined date) | git | [x] |
| 28 | **Q.28** | **Group topics / threads** (Telegram-style topics) | git | [x] |
| 29 | **Q.29** | **Large groups** (raise cap toward 50; perf test) | git | [x] |
| 30 | **Q.30** | **Broadcast lists** (one-to-many to contact subsets) | git | [x] |

#### Wave 6 — Calls & realtime (no screen share)

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 31 | **Q.31** | **TURN off-LAN proof** — cellular ↔ Wi‑Fi matrix (TASK P.6 / J) | Founder | [ ] |
| 32 | **Q.32** | **Call quality indicator + reconnect UX** | git | [x] |
| 33 | **Q.33** | **Raise hand + mute all** (group calls) | git | [x] |
| 34 | **Q.34** | **Group call signaling E2E** — close cleartext SDP fallback (TASK O.2 finish) | git | [x] |
| 35 | **Q.35** | **SFU Phase B** — group calls 9+ (mediasoup; mesh cap 8 today) | git | [x] |

#### Wave 7 — Account, profile, onboarding

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 36 | **Q.36** | **Email verification** for password register (activation link) | git | [x] |
| 37 | **Q.37** | **Display name** (separate from locked username) | git | [x] |
| 38 | **Q.38** | **Profile bio / about** | git | [x] |
| 39 | **Q.39** | **In-app FAQ / help center** (offline markdown) | git | [x] |
| 40 | **Q.40** | **Passkeys / WebAuthn** (optional login) | git | [x] |
| 41 | **Q.41** | **Account recovery key** (show-once backup codes for vault path) | git | [x] |

#### Wave 8 — Notifications (incl. desktop)

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 42 | **Q.42** | **Desktop notifications polish** — tray badge, focus on click | git | [x] |
| 43 | **Q.43** | **Reply from notification** (Android first) | git | [x] |
| 44 | **Q.44** | **Per-chat mute durations** + Android notification channels | git | [x] |
| 45 | **Q.45** | **Custom notification sounds** (optional) | git | [x] |

#### Wave 9 — Translation & languages

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 46 | **Q.46** | **Desktop translation QA** + model-download progress UI | Founder+git | [x] |
| 47 | **Q.47** | **UI language pack #2** — add `fr` + `de` as lazy-loaded JSON (pattern for more) | git | [x] |
| 48 | **Q.48** | **On-device message translate** — expand pairs (e.g. `pt`, `it`, `fr`, `de`) per platform capability | git | [x] |

#### Wave 10 — Security & crypto hardening

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 49 | **Q.49** | **App lock** — PIN / biometric on cold start | git | [x] |
| 50 | **Q.50** | **Hardware-backed device wrap** finish (TASK O.3) | git | [x] |
| 51 | **Q.51** | **Multi-device / linked devices** (Signal-style) | git | [x] |
| 52 | **Q.52** | **Sealed sender** | git | [x] |
| 53 | **Q.53** | **Key-change warnings** (prominent, no QR) | git | [x] |
| 54 | **Q.54** | **Retire legacy RSA send path** (decrypt-only until migration complete) | git | [x] |
| 55 | **Q.55** | **Post-quantum hybrid** — bump libsignal when upstream PQXDH available | git | [x] |

#### Wave 11 — Trust, ops, distribution

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 56 | **Q.56** | **OWASP ZAP CI** + security smoke | git | [x] |
| 57 | **Q.57** | **Public threat-model page** (user-readable) | git | [x] |
| 58 | **Q.58** | **disclose.io** + security.txt | Founder | [x] |
| 59 | **Q.59** | **Crash reporting opt-in** (Firebase Crashlytics or Sentry) | git | [ ] |
| 60 | **Q.60** | **Status page** (health + incident notes) | Founder | [ ] |
| 61 | **Q.61** | **Code signing** — Windows Authenticode + Mac notarize (TASK P.8) | Founder | [ ] |
| 62 | **Q.62** | **Google Play public listing** (TASK N.8 / P.9) | Founder | [ ] |
| 63 | **Q.63** | **iOS App Store** (TASK K) | Founder | [ ] |

#### Wave 12 — Resume full QA

| # | ID | Subtask | Owner | Status |
|---|-----|---------|-------|--------|
| 64 | **Q.64** | **TASK J full device matrix** on release candidate after Q.1–Q.15 minimum | Founder | [ ] |

**Estimated calendar:** Waves 1–3 ≈ 8–12 weeks solo; full Q.1–Q.63 ≈ 6–12 months at one-task-at-a-time pace with contributors on isolated subtasks.

---

## Suggestions (straight talk)

**Do now (before wider testers):**
1. Run full **TASK J matrix** on v1.0.5 — this is the real gate.
2. Test **cellular ↔ Wi‑Fi call** — if it fails, TURN is not optional for US↔UK.
3. Do **not** recreate tester-win/tester-android accounts until retention timer check (per policy).

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
| A.10 | Founder retest: no crypto jargon; messages still E2E | tester-win ↔ tester-android after rebuild | [ ] |

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
| B.5 | Founder QA: force-stop Android → reopen → still in chat | tester-android device after rebuild | [ ] |

---

### TASK C — Real-time contacts & friend requests · ✅ DONE (24 Jun 2026)

**Goal:** Pending badge and roster update live while app is open.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| C.1 | WS events: `friend-request`, `friend-request-sent`, `friend-accepted`, `friend-rejected`, `contacts-changed` | `contact_realtime.py`, `contacts.py` | [x] |
| C.2 | Client refresh on WS + `ssc-contacts-refresh` event | `ChatHome.jsx`, `contactRealtime.js` | [x] |
| C.3 | FCM foreground/background → `dispatchContactsRefresh` | `native-push.js` | [x] |
| C.4 | Founder QA: send request PC → phone pending live | tester-win → tester-android after rebuild | [ ] |
| C.5 | Founder QA: accept on phone → PC roster live | tester-android → tester-win after rebuild | [ ] |

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
| D.7 | QA matrix: voice call, video call, cancel, busy | tester-win ↔ tester-android after rebuild | [ ] |

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
| E.6 | QA: PC ↔ phone image + voice note round-trip | tester-win ↔ tester-android after rebuild | [ ] |

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
| F.5 | QA: block/mute on PC + phone; create 2-member group; send message | tester-win ↔ tester-android after rebuild | [ ] |

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
| G.6 | Founder QA: Samsung gesture back — no reopen loop | tester-android device after rebuild | [ ] |

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
| H.7 | **Profile tap** sheet (mute, block) | P1-10 | [x] → `ProfileContactSheet.jsx` (TASK M.1) |
| H.8 | Desktop **incoming call ringtone** | P2-1 | [x] |

---

### TASK I — Infrastructure & release prep

| ID | Subtask | Target | Status |
|----|---------|--------|--------|
| I.1 | **Custom domain** + DNS for API / hosting | ~28 Jun 2026 | [x] `www` + `api.supersecurechat.com` live |
| I.2 | **Turnstile** captcha on production register/login | ~28 Jun 2026 | [x] P.1–P.2 + v1.0.8 clients |
| I.3 | **TURN** verification off-LAN (cellular ↔ Wi‑Fi calls) | Founder manual | [ ] |
| I.4 | **Retention proof** — 24h delete on tester-win ↔ tester-android thread | In progress (backend proof pass; founder thread proof pending) | [~] |
| I.5 | Rebuild **APK + desktop** after TASK batches; bump version | Post-fix | [x] |
| I.6 | **Play Store** listing (AGPL review ✅) | Post-P0 | [ ] |
| I.7 | Redeploy Cloud Run when backend changes | Per deploy | [x] |

---

### TASK J — QA verification matrix (before wider testers)

Run on **tester-win (Win)** + **tester-android (Android)** against production API.

| Area | Test | Depends on | Status |
|------|------|------------|--------|
| Auth | Google login both devices | — | [x] |
| Auth | Stay logged in after force-close | TASK B | [x] code · [ ] founder retest |
| Auth | Google-only email login shows friendly error | TASK H.5 | [x] backend smoke · [ ] founder retest |
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

### TASK L — Hardening execution queue (must run 1 by 1, fully)

**Execution contract:** No skipping, no parallel shortcuts, no status inflation. Mark `[x]` only when code + verification evidence are complete and logged.

| ID | Subtask | Evidence required | Status |
|----|---------|-------------------|--------|
| L.1 | Server retention janitor: purge orphaned file records + GridFS blobs after expiry window | code diff + report in `test_reports/` + changelog note | [x] |
| L.2 | Retention attestation report/endpoint (TTL indexes, expires_at coverage, expired pending, orphan blobs) | endpoint/script output + roadmap entry | [x] |
| L.3 | WebSocket hardening: remove JWT query fallback, enforce short-lived ticket-only handshake | code diff + WS auth smoke | [x] |
| L.4 | Abuse defenses pass: stricter rate limits for friend requests, group create, file upload bursts; add clear 429 telemetry | code diff + config notes + smoke evidence | [x] |
| L.5 | Security observability: anomaly logging/alerts for retention failures, Redis fallback, and auth abuse spikes | structured log events + documented runbook | [x] |
| L.6 | Deploy gate hardening: fail deploy when retention proof regresses or required security env is weak | CI/script gate proof + deploy script update | [x] |
| L.7 | Infra hardening follow-through: Turnstile production enable + TURN off-LAN verification + custom domain rollout | deploy evidence + QA evidence + roadmap update | [~] Turnstile + api.supersecurechat.com done; off-LAN call proof pending |

---

### TASK M — In-app UX polish (phase 2) · [~] IN PROGRESS

**Goal:** App feels finished — profile, Settings, trust, fewer dead ends. Aligns with `memory/PRODUCT_BLUEPRINT.md` §UX.

| ID | Subtask | Files / notes | Status |
|----|---------|---------------|--------|
| M.1 | **Profile tap sheet** — avatar/name in chat header → mute/block | `ProfileContactSheet.jsx`, `ChatHome.jsx` | [x] |
| M.2 | **Settings: blocked contacts list** + unblock | `SettingsModal.jsx` | [x] |
| M.3 | **Settings: panic wipe** in Security section | `SettingsModal.jsx`, `PanicButton.jsx` | [x] |
| M.4 | **Settings: push enable** + help/support link | `SettingsModal.jsx` | [x] |
| M.5 | **Change password** (password accounts only) | `auth` router + Settings | [x] |
| M.6 | **User retention picker** (1h / 6h / 24h / 7d) | backend policy + Settings | [x] shipped as **Q.5** (1/2/4/8/24h + 7d/30d) |
| M.7 | **Delete account** flow | backend + Settings + confirm | [x] `POST /auth/delete-account` |
| M.8 | **Loading / error states** — decrypt retry, skeletons | `Message.jsx`, `ChatHome.jsx`, `ChatSkeleton.jsx` | [x] |
| M.9 | **Stories UX pass** — views, delete, navigation | `Stories.jsx` | [x] i18n + Escape + viewer polish |
| M.10 | **Calls visual polish** — failed/reconnect copy | `CallModal.jsx` | [x] status labels + end reasons |
| M.11 | **Group admin** — rename, add/remove members | `GroupManageModal.jsx`, API | [x] local rename + member API |
| M.12 | **Last-seen privacy toggle** | Settings + API | [x] shipped as **Q.6** |

---

### TASK N — Public surface & trust · [x] DONE (N.8 deferred)

**Goal:** `supersecurechat.com` ready for testers and store review.

| ID | Subtask | Owner | Status |
|----|---------|-------|--------|
| N.1 | **Privacy Policy** page `/privacy` | code | [x] |
| N.2 | **Terms of Use** page `/terms` | code | [x] |
| N.3 | **Landing footer** — real version, legal links, contact email | `Landing.jsx` | [x] |
| N.4 | **Download links** on landing (`REACT_APP_DOWNLOAD_*`) | `scripts/prepare_downloads.ps1` + hosting | [x] `/downloads/` on Firebase Hosting |
| N.5 | **Landing v2/v3** — scrollable layout, downloads section, prominent contact, unified buttons | `Landing.jsx`, `MarketingPage.jsx` | [x] 26 Jun 2026 |
| N.6 | **`contact@supersecurechat.com`** Porkbun hosted email | Porkbun hosted inbox + site mailto | [x] inbound from Gmail confirmed 26 Jun 2026 |
| N.7 | **Firebase App Distribution** link on landing | `scripts/upload_app_distribution.ps1` | [x] v1.0.8 (9) uploaded; beta link on landing |
| N.8 | **Play Store** listing assets | founder + TASK I.6 | [ ] deferred — **next week** (paid) |

---

### TASK O — Crypto & security hardening (code) · [~] IN PROGRESS (26 Jun 2026)

**Goal:** Close gaps from 26 Jun security audit before public launch. See §Security audit grades.

| ID | Subtask | Risk addressed | Status |
|----|---------|----------------|--------|
| O.1 | **Retire RSA send path** on installed clients (read-only legacy decrypt) | dual-crypto surface | [x] `maySendLegacyRsa()` |
| O.2 | **Encrypt group call signaling** (Sender Keys wrap) | cleartext SDP on server | [x] `webrtcSignaling.js` group path |
| O.3 | **Hardware-backed device wrap** — Android EncryptedSharedPreferences + Electron safeStorage | localStorage theft | [x] |
| O.4 | **Verify UI** — profile sheet only; badge not in default chat | dev confusion | [x] |
| O.5 | **Structured self-audit checklist** | marketing trust | [x] `test_reports/TASK_O_SELF_AUDIT_CHECKLIST.md` |
| O.6 | **Mongo network tighten** (private endpoint or IP allowlist) | credential leak blast radius | [x] GCP NAT **34.140.240.41** + VPC connector + Cloud Run egress · Atlas allowlist via `scripts/apply_atlas_ip_allowlist.py` |

---

### TASK P — Founder setup checklist (infra — you do these)

**Goal:** Unblock L.7 / I / N without code. Check off as completed; log evidence in `test_reports/`.

| # | Action | Where | Blocks |
|---|--------|-------|--------|
| P.1 | Create **Cloudflare Turnstile** site + secret keys | Cloudflare dashboard | L.7, I.2, bot abuse | [x] 26 Jun 2026 |
| P.2 | Add keys to `backend/cloud_run.env` + `REACT_APP_TURNSTILE_SITEKEY` | redeploy API + rebuild clients | L.7 | [x] API **00018-gnx** + hosting rebuild |
| P.3 | Map **`api.supersecurechat.com`** → Cloud Run | GCP console or `gcloud beta` + Porkbun DNS | L.7, I.1 | [x] SSL live; `/api/health` 200 |
| P.4 | Update **Google OAuth** authorized domains + redirect URI | Google Cloud Console | OAuth on new API domain | [x] 26 Jun 2026 |
| P.5 | Update **CORS_ORIGINS** + `GOOGLE_REDIRECT_URI` + `REACT_APP_BACKEND_URL` | `cloud_run.env` + frontend env | clients | [x] api.supersecurechat.com |
| P.6 | **TURN off-LAN call test** (cellular ↔ Wi‑Fi) | tester-win ↔ tester-android | I.3, L.7 |
| P.7 | **Porkbun hosted email** `contact@` + DNS (SPF/DKIM) | Porkbun | [x] N.6 — click Fix DNS when testing inbound |
| P.8 | **Windows code signing** cert (optional) | SSL.com / DigiCert | SmartScreen | [ ] **next week** |
| P.9 | **Play Console** developer account ($25) | Google Play | I.6 | [ ] **next week** |
| P.10 | **GCP log alerts** per `SECURITY_OBSERVABILITY_RUNBOOK.md` | Cloud Logging (free tier) | [ ] optional ops — not paid setup |

---

## Security audit snapshot (26 Jun 2026)

| Layer | Grade | Notes |
|-------|-------|-------|
| Crypto design (installed) | **A-** | libsignal 0.96.4 PQXDH; contact-gated prekeys |
| Server exposure | **B** | ciphertext messages; group call SDP gap |
| Abuse resistance | **B** | rate limits ✅; Turnstile ✅ (register/login) |
| Client secret storage | **B** | AES device wrap; wrap key in hardware store (Electron safeStorage / Android EncryptedSharedPreferences) |
| Product UX | **B-** | TASK M complete; founder QA (J) still pending |
| Public launch readiness | **C+** → target **B-** after J + O + P.6 |

**Marketing rule (unchanged):** Signal-grade E2E on **installed apps** — not browser tab; not “audited like Signal” until O.5.

---

## Phased execution order (locked 26 Jun 2026)

```
Phase 1 — Trust perimeter (TASK P + L.7 + N.4–N.7)     ← founder + deploy
Phase 2 — In-app polish (TASK M)                        ← code [~]
Phase 3 — Crypto hardening (TASK O)                     ← code
Phase 4 — Founder QA (TASK J)                           ← devices (when ready)
Phase 5 — Wider testers + Play Store (I.6, N.8)         ← launch
```

---

## Recommended start order (pick one — founder decides)

| Order | Rationale |
|-------|-----------|
| **1 → A then B then C** | *Product feel first:* hide vault/crypto noise, stay logged in, live contacts — biggest “not like WhatsApp” gaps |
| **2 → C then B then D** | *Connectivity first:* real-time social graph + session + calls — unblock daily use |
| **3 → G then D then E** | *Android pain first:* back stack + permissions + media — tester-android device UX |
| **4 → A only (sprint)** | Quick win: invisible security UX before touching backend |

**Suggested default:** **TASK A** (invisible security) → **TASK B** (session) → **TASK C** (real-time) → **TASK G** (Android back) → **TASK D/E/F** in parallel where possible.

---

## Founder QA snapshot (24 Jun 2026)

**Devices:** Windows `tester-win` v1.0.4 ↔ Android `tester-android` v1.0.3–1.0.4 · Production API

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
| 2026-06-24 | Founder QA tester-win ↔ tester-android · P0–P2 backlog |
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
| 2026-06-26 | **TASK I.4 progress** — production retention proof PASS (TTL indexes + expires_at coverage + expired rows=0) saved to `test_reports/retention_proof_2026-06-26.json`; founder 24h thread proof still pending |
| 2026-06-26 | **TASK J auth smoke** — production `/api/auth/login` returns `401` + `x-auth-provider: google` with friendly Google-only guidance |
| 2026-06-26 | **TASK L.1 complete** — server retention janitor added (`core/retention_janitor.py`, startup wiring in `lifespan.py`, one-shot runner `scripts/retention_janitor.py`); evidence saved to `test_reports/retention_janitor_2026-06-26.json` |
| 2026-06-26 | **TASK L.2 complete** — retention attestation expanded with orphan GridFS checks (`core/retention_proof.py`), authenticated endpoint added at `/api/retention/attestation`, evidence saved to `test_reports/retention_attestation_2026-06-26.json` |
| 2026-06-26 | **TASK L.3 complete** — WebSocket now accepts ticket-only auth (`/api/ws?ticket=...`), JWT query fallback removed in backend + frontend socket client; smoke evidence saved to `test_reports/ws_ticket_only_smoke_2026-06-26.json` |
| 2026-06-26 | **TASK L.4 complete** — abuse defenses tightened (friend-request burst/daily, group-create, file-upload burst/sustained) with structured `rate-limit reject` telemetry; smoke evidence saved to `test_reports/rate_limit_smoke_2026-06-26.json` |
| 2026-06-26 | **TASK L.5 complete** — security observability hooks added (`core/security_observability.py`) for Redis fallback + retention janitor anomalies, with operational runbook `memory/SECURITY_OBSERVABILITY_RUNBOOK.md`; smoke evidence saved to `test_reports/security_observability_smoke_2026-06-26.log` |
| 2026-06-26 | **TASK L.6 complete** — deploy gate hardened in `scripts/prepare_cloud_run_deploy.py` (strict env validation + mandatory retention proof gate); evidence saved to `test_reports/deploy_gate_hardening_2026-06-26.md` |
| 2026-06-26 | **TASK L.7 in progress (blocked)** — production confirms Turnstile disabled and Cloud Run default domain still active; TURN creds present but off-LAN device proof pending. Blockers/evidence logged in `test_reports/infra_hardening_l7_status_2026-06-26.md` |
| 2026-06-26 | **Post-audit roadmap** — TASK M (UX), N (public), O (crypto hardening), P (founder infra checklist) added; `PRODUCT_BLUEPRINT.md` aligned |
| 2026-06-26 | **TASK M.1–M.4** — `ProfileContactSheet.jsx`; Settings blocked list, panic in Settings, push enable, help link; `/privacy` + `/terms`; landing footer + legal links |
| 2026-06-26 | **TASK M.8** — message decrypt retry, slow-timeout hint, i18n error copy (`Message.jsx`) |
| 2026-06-26 | **TASK M.5** — `POST /auth/change-password` + Settings form for password accounts |
| 2026-06-26 | **TASK P deploy** — API `ssc-api-00017-whm` redeploy; Firebase Hosting (Privacy/Terms live); CORS for supersecurechat.com; `scripts/verify_task_p.ps1` + `TASK_P_FOUNDER_STEPS.txt` |
| 2026-06-26 | **TASK P.1–P.5 complete** — Turnstile live; `api.supersecurechat.com` SSL; Google OAuth redirect; v1.0.8 APK/desktop/hosting |
| 2026-06-26 | **TASK M.7** — `POST /auth/delete-account` + Settings delete flow |
| 2026-06-26 | **TASK M.8–M.11** — chat skeletons; Stories i18n; call status copy; `GroupManageModal` + group member API; leave-group no longer deletes conv for all |
| 2026-06-26 | **TASK N.4–N.5** — landing download CTAs; `/downloads/` hosting; `LandingScreenshots`; `deploy_hosting.ps1` |
| 2026-06-26 | **TASK N.6–N.7** — `contact@` on site; Porkbun hosted inbox; App Distribution v1.0.8; TASK N closed (N.8 deferred) |
| 2026-06-26 | **Landing v3** — scrollable `MarketingPage`; downloads + contact sections; unified buttons; **P.8/P.9/N.8** postponed to next week; **TASK J** scheduled 27 Jun |
| 2026-06-26 | **Construction gate** — invite-only password (`REACT_APP_SITE_PREVIEW_PASSWORD`); 5-try lockout; `?access=` bookmark; flip `REACT_APP_SITE_UNDER_CONSTRUCTION=false` at launch |
| 2026-06-26 | **Founder plan** — J all-day 27 Jun; O.1–O.6 after J; paid store items next week; site gate until app flow ≥90%; N.6 Gmail→contact@ inbound OK |
| 2026-06-26 | **TASK O code** — RSA send blocked installed; group signaling encrypt; hardware device wrap; verify via profile sheet; self-audit checklist; Atlas hardening doc; Mongo MCP installed |
| 2026-06-27 | **Gap fix** — GridFS orphans 0 (prod+dev); O.6 GCP NAT **34.140.240.41** + `ssc-vpc-connector` + Cloud Run `ssc-api-00021-6k6`; evidence `test_reports/gap_fix_gridfs_o6_2026-06-27.md` |
| 2026-06-27 | **O.6 closed** — Atlas allowlist: `34.140.240.41/32` + `86.166.40.195/32` only; `0.0.0.0/0` removed; `/api/health` mongo+redis ok |
| 2026-06-27 | **API redeploy** — `ssc-api-00022-jzs` (janitor loop fix + latest `main`); health ok post Atlas lockdown |
| 2026-06-27 | **v1.0.9** — TASK O client rebuild (APK build 10 + Windows); PRODUCT_BLUEPRINT v2.2; housekeeping notes; full founder audit |
| 2026-06-28 | **TASK Q added** — 63-step serial expansion wave (founder directive): web reopen, UX parity, groups, calls, privacy, crypto, trust; locked: no QR, no downloads on site, retention picker 1h–30d |
| 2026-06-28 | **Q.1 done** — public under-construction landing (no password wall, no downloads/beta, Updates/Stage section); preview gate opt-in via `REACT_APP_SITE_PREVIEW_GATE` |
| 2026-06-28 | **Q.2 done** — installed clients seed UI language from `navigator.languages` on first launch; Settings override still wins |
| 2026-06-28 | **Q.3 done** — split-pane chat at ≥768px or tablet landscape ≥600px; native apps no longer forced single-pane; safe-area landscape CSS |
| 2026-06-28 | **Desktop translation** shipped (`4a949af`); **protobufjs** pinned 7.6.1 (`7361c24`) |
| 2026-06-24 | **TASK D complete** — permissions, duplex audio, ringtone; frontend 55 tests |
| 2026-06-24 | **TASK E complete** — voice/images/files; frontend 62 tests |
| 2026-06-24 | **TASK F complete** — block/mute/groups; frontend 67 tests |
| 2026-06-24 | **Pre-deploy audit** — block roster + group modal crash fixed |
| 2026-06-24 | **v1.0.5 deploy** — API `ssc-api-00013-6dd` + APK build 7 + `SSC-Setup-1.0.5.exe` |