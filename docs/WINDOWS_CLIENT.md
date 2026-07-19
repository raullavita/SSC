# SSC Windows client (ready for Android ↔ Windows E2EE)

**Status (0.4.0 / build 15):** Shipping Windows messenger uses **Electron shell + `@signalapp/libsignal-client` 0.96.4** — the **same protocol stack version as Android** (`libsignal-android` 0.96.4).

This is intentional so you can test **Android ↔ Windows** encrypted messages end-to-end against production.

## Why not pure Qt yet?

| Path | E2EE interop with Android | Build on this machine |
|------|---------------------------|------------------------|
| **`electron/` Windows installer** | Yes — real libsignal sessions | Yes (Node + electron-builder) |
| **`desktop/` Qt Quick** | No — scaffold only (no libsignal FFI) | Needs Qt 6 + CMake + MSVC |

Qt remains the long-term native UI target (`desktop/`). It is **not** ready for A↔W crypto tests.

## Build (unsigned free sideload)

```powershell
cd C:\Users\smash\ssc
.\scripts\build_electron.ps1
```

Outputs:

- `electron\dist\SSC-Setup-0.4.0.exe`
- `dist\SSC-Setup-0.4.0.exe`
- optional Desktop copy

SmartScreen may warn (no paid Authenticode). Use **More info → Run anyway** for personal testing.

## Runtime identity

- Header: `X-SSC-Client: windows/0.4.0/15`
- Bridge: `X-SSC-Native-Bridge: v1`
- Crypto: main-process `libsignalSession.js` via preload `window.sscCrypto`
- API: `https://api.supersecurechat.com`

Production **rejects** clients below min version 0.4.0 — do not use old `SSC-Setup-0.3.1.exe`.

## Android ↔ Windows test checklist

1. Install **Android** APK 0.4.0/15 (Compose) and register/login (Turnstile on register).
2. Install **Windows** `SSC-Setup-0.4.0.exe`, login with a **different** account.
3. On Android: add Windows user (username / friend request) and open direct chat.
4. Send text both ways; confirm decrypt on both devices (not `[unable to decrypt]`).
5. Optional: attachment / voice if both clients support the same wire paths.

## Do not

- Ship **SAC_COMPAT** Electron builds for messaging (libsignal disabled).
- Point production tests at the Qt `desktop/` scaffold.
- Change Android Compose sources when iterating Windows builds (keep trees separate).

## Android

Unchanged by the Windows workstream. Primary mobile path remains Jetpack Compose.
