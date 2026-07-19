# SSC Native Client Charter

**Version:** 1.0  
**Locked:** 2026-07-19  
**Status:** Binding product architecture

## Product rule (locked)

SSC **installed clients** use **true native UI only**:

| Forbidden | Required |
|-----------|----------|
| Android `WebView` for messenger UI | Kotlin + **Jetpack Compose** |
| iOS `WKWebView` for messenger UI | Swift + **SwiftUI** |
| **Electron** for desktop UI | **Qt Quick / QML** (Windows + macOS) |
| React/HTML as the chat product | Shared **backend + protocol** only |

Marketing website (Firebase Hosting / landing) may remain web. That is **not** an installed client.

## Platform plan

| Platform | UI | Crypto | Order |
|----------|-----|--------|-------|
| **Android** | Jetpack Compose | libsignal-android (existing) | **1 — reference client** |
| **iOS** | SwiftUI | libsignal-swift | 2 |
| **Windows + macOS** | Qt Quick (QML) | libsignal via native FFI | 3 |

## Decisions locked with owner (2026-07-19)

1. **Build order:** Android first (reference for API + crypto + UX patterns).
2. **Hybrid / WebView / Electron:** **Removed from product plan immediately.** No further feature work. Not a fallback path.
3. **Qt UI style:** **Qt Quick / QML** (not pure Widgets-only C++).
4. **Android native v1 goal:** **Full feature parity** with the previous React installed app (auth, chat, groups, files, reactions, calls, stories, settings, multi-device, backup, etc.).

### How parity is delivered (process, not a softer goal)

Parity is the **ship bar for Android native v1**, but work is still **milestone-ordered** so the app is testable continuously:

| Milestone | Scope |
|-----------|--------|
| **A0** | Compose shell, no WebView, session HTTP client, theme, nav |
| **A1** | Login / register / me / logout + device id + installed-client headers |
| **A2** | Conversation list + open thread + history fetch |
| **A3** | libsignal 1:1 encrypt/decrypt send/receive + prekeys |
| **A4** | Realtime WebSocket + push (FCM) |
| **A5** | Groups + sender keys |
| **A6** | Attachments, voice notes, reactions, read receipts, typing |
| **A7** | Calls (WebRTC native) + SFU signaling |
| **A8** | Stories, polls, broadcast lists, friend requests |
| **A9** | Settings, privacy, multi-device link, backup/recovery, panic wipe |
| **A10** | Parity checklist signed off → Play-ready packaging |

iOS and Qt follow the same feature set after Android is the reference.

## What we keep from the monorepo

- `backend/` — FastAPI, policies, WS, push, SFU, E2EE relay
- Android **libsignal** session stores (`LibsignalSession`, Keystore secure store, FCM service)
- API contracts (`X-SSC-Client`, `X-SSC-Device-Id`, `X-SSC-Native-Bridge`, Bearer / session)
- Website landing (frontend **landing-only** builds)

## What we stop treating as product

- Electron installer as the desktop app
- Android/iOS WebView shells loading React
- Shared React messenger UI for installed clients
- `scripts/build_electron*.ps1` / React-into-`assets/www` as the ship pipeline

Code may remain in-tree briefly for reference while native ports land; it is **not** the product path and must not receive feature investment.

## Suggestions accepted into plan

1. **Backend stays shared** — do not rewrite server for native clients.
2. **No shared web UI layer** — each OS owns UI; share only protocol docs + optional OpenAPI later.
3. **Local DB** — each native client uses platform SQLite (or equivalent) for messages/cache as features land (A2+).
4. **Bearer token** — native clients store `ws_token` from login and send `Authorization: Bearer` (server allows bearer fallback).
5. **Client header** — keep `android/0.3.x/build` (and later ios/windows/mac); drop `electron` from *new* clients when policy is cleaned.
6. **Qt on mobile is out of scope** — Compose + SwiftUI only on phones.

## Success definition

User installs SSC from store / sideload and sees **platform-native** UI with no Chromium/WebView process for chat. Crypto remains libsignal. Server remains the current SSC API.

## Non-goals (for this charter)

- Feature race with Telegram on every gimmick before core native is solid
- Rewriting backend in another language
- Keeping Electron “just for Linux” as a product client
