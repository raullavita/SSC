# Changelog

All notable changes to SSC (Super Secure Chat) are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
SSC is open source under [AGPL-3.0](LICENSE); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for libsignal attribution.

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

[0.2.0]: https://github.com/raullavita/SSC/releases/tag/v0.2.0
[0.1.0]: https://github.com/raullavita/SSC/releases/tag/v0.1.0