# Changelog

All notable changes to SSC (Super Secure Chat) are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
SSC is open source under [AGPL-3.0](LICENSE); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for libsignal attribution.

## [0.4.0] - 2026-07-19

### Changed (native rebuild — build 15)

- **Android is pure Jetpack Compose** — **no WebView**, no React messenger UI in the APK
- **Architecture locked:** Compose (Android) · SwiftUI (iOS planned) · Qt Quick (desktop planned) · backend unchanged
- **Native stack:** `SscHttpClient`, encrypted session store, OkHttp WebSocket realtime, SQLite message cache, FCM register, libsignal 1:1 + group sender-key path
- **Product path:** Electron / WebView hybrid **retired** (see `memory/NATIVE_CLIENT_CHARTER.md`)

### Added (Android Compose parity)

- Auth: login, register, Google OAuth path, recovery, panic wipe, username + invite share
- Messaging: multi-device ciphertexts, groups + sender keys, reply/edit/delete, typing, thread filter, read ticks
- Sealed sender + disappearing defaults; media files + voice notes; stories; encrypted polls + votes
- Reactions (emoji picker + aggregates); pin/mute; global privacy; broadcast lists; encrypted backup
- Prekey status + auto-replenish; group members + leave
- **Calls:** 1:1 mesh WebRTC audio/video; **group mediasoup SFU** join/produce/consume; video tiles; mute/cam
- Free sideload docs: `docs/FREE_DISTRIBUTION.md`

### Added (backend / SFU)

- SFU room credential fan-out (`sfu_room` WS) on create
- SFU server: `existingProducers` for late joiners, peer cleanup, `getProducers`
- Production SFU + TURN wiring docs: `docs/LIVE_SFU_HARDEN.md`

### Added

- Parity tracker: `memory/NATIVE_ANDROID_PARITY.md`
- iOS / Qt desktop scaffolds under `ios/` and `desktop/`

## [0.3.1] - 2026-07-06

### Added (build 12)

- **Native Android client** — Kotlin WebView shell with bundled React UI and native `libsignal-android` bridge: login, chats, encrypted 1:1 messaging, WebSocket realtime
- **Firebase App Distribution** — native APK for phone testers (`scripts/distribute_android.ps1`)

### Fixed (build 12)

- **Android emulator encryption** — bundle x86_64/x86 libsignal JNI so Kyber prekeys work on PC emulators
- **Chats screen after login** — crypto init no longer blocks conversation list; clearer encryption errors

### Added

- **Desktop attestation (free HMAC)** — `SSC_DESKTOP_ATTEST_SECRET` for Electron/Windows/Mac; Electron preload token generator
- **Smoke test installed-client probes** — `/api/config` and `/api/auth/login` with `X-SSC-Client` + attest headers
- **Knip in CI** — unused export checks on every push/PR
- **`yarn install:local`** / `scripts/install_frontend.ps1` — Node 20 `--ignore-engines` helper

### Fixed

- **wsSubscribe.js** — `/api/config` and `/api/ws/subscribe-token` paths (was missing `/api` prefix)
- **iOS crypto bridge** — synced `__sscBridge` persistence with Android
- **Knip dead exports** — `isSafeAttachmentPreview`, `resetCaptchaConfigCache` cleaned up

### Changed

- Version **0.3.1 (build 9)** across API health, clients, and build scripts
- Roadmap: D1 CAPTCHA partial (prod off until Turnstile keys); B9 knip complete with CI

## [0.3.0] - 2026-07-05

### Added

- **Usernames + invites** — `@username` discovery, `/add/{username}` links, Settings QR + copy
- **Read receipts UI** — opt-in ✓✓ with per-chat overrides and WS fanout
- **Call reliability** — ICE queue, hangup/missed flow, ring timeout, Android media permissions
- **Message lifecycle** — edit within TTL, delete for me/everyone, forward as encrypted message
- **Safety numbers + trust** — client-only trust store, verification QR, key-change banners
- **Per-chat privacy** — read receipts, typing, last seen, disappearing defaults per conversation
- **Multi-device QR link** — `ssc://link-device` deep links, expiry countdown, device list polish
- **Encrypted backup** — passphrase `.ssc-backup` export/restore in Settings (client-only)
- **Android shell polish** — splash screen, deep links, pull-to-refresh, offline retry, file chooser
- **Release checklist** — `memory/RELEASE_v0.3.0_CHECKLIST.md`, `step18_proof.py`

### Changed

- Version bumped to **0.3.0** across clients, API health, and build scripts
- Android `versionCode` 3, `X-SSC-Client: android/0.3.0/3`
- First GitHub Release with attached **Electron installer** and **Android APK**

### Open source

- Source: https://github.com/raullavita/SSC  
- License: AGPL-3.0  
- E2E crypto: [Signal libsignal](https://github.com/signalapp/libsignal) (AGPL-3.0)

## [0.2.0] - 2026-07-05

### Added

- **Stories** — encrypted story posts with expiry (`stories` API, `StoriesBar` UI)
- **Polls** — encrypted group polls (`polls` API, `PollBubble` UI)
- **Disappearing messages** — server-side expiry filter + client countdown/prune
- **Professional landing page** — product info, security model, and prominent open-source / AGPL compliance at [supersecurechat.com](https://www.supersecurechat.com)
- **Release checklist** — `memory/RELEASE_v0.2.0_CHECKLIST.md` for production deploy verification
- **Step 8 proof gate** — `backend/scripts/step8_proof.py`

### Changed

- **Metadata hardening** — auth omits email; WS fanout strips participants; sealed sender default-on
- **Android libsignal** — native bridge on `libsignal-android` 0.96.4 (replaces dev envelope)
- **Group sender keys** — real libsignal sender-key distribution (replaces XOR placeholder)
- **TURN for calls** — `GET /api/calls/ice-servers` with coturn credentials
- **Production crypto** — dev/placeholder protocols rejected; `InstalledClientGate` requires real libsignal
- **Panic wipe** — clears this user + this device only; shared conversations preserved for others
- Version bumped to **0.2.0** across clients, API health, and build scripts

### Security

- Production builds forbid dev crypto fallbacks (`REACT_APP_SSC_REQUIRE_LIBCRYPTO`)
- Link previews off by default; recursive payload scrubbing on API responses
- Private vulnerability reporting via [SECURITY.md](SECURITY.md)

### Open source

- Source: https://github.com/raullavita/SSC  
- License: AGPL-3.0  
- E2E crypto: [Signal libsignal](https://github.com/signalapp/libsignal) (AGPL-3.0)

## [0.1.0] - 2026-07-04

Initial public release — install-only E2E messenger (Android + Windows Electron).

- Signal Protocol (PQXDH / Kyber) via libsignal
- Messaging, reactions, files, voice notes, 1:1 and group calls
- FCM push, mediasoup SFU scaffold, Firebase Hosting + Cloud Run production deploy
- Engines 1–14 gates, CI, ZAP security scan

[0.3.0]: https://github.com/raullavita/SSC/releases/tag/v0.3.0
[0.2.0]: https://github.com/raullavita/SSC/releases/tag/v0.2.0
[0.1.0]: https://github.com/raullavita/SSC/releases/tag/v0.1.0