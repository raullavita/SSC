# SSC Desktop — Qt Quick / QML

**Architecture (locked):** True native desktop. **No Electron. No WebView UI.**

Windows + macOS (+ Linux later) from one Qt codebase.

## Stack

| Layer | Tech |
|-------|------|
| UI | Qt 6 Quick / QML |
| Network | `QNetworkAccessManager` (`SscApiClient`) |
| Session | `QSettings` (`SscSession`) |
| Crypto | libsignal via FFI (next milestone) |
| Client header | `windows/0.4.0/15` or `mac/0.4.0/15` |

## Status

- Scaffold: login, conversation list refresh, logout
- No Chromium/Electron UI here
- **Not ready for Android ↔ Windows E2EE tests** (no libsignal FFI yet)

**Shipping Windows messenger today:** see [`docs/WINDOWS_CLIENT.md`](../docs/WINDOWS_CLIENT.md)  
(`.\scripts\build_electron.ps1` → `SSC-Setup-0.4.0.exe` with libsignal 0.96.4).

## Build (free — no paid Windows code signing required)

```bash
# Requires Qt 6.5+ with Quick, Network, WebSockets
cmake -S desktop -B desktop/build -DCMAKE_PREFIX_PATH=/path/to/Qt/6.x/gcc_64
cmake --build desktop/build
```

Windows (example):

```powershell
cmake -S desktop -B desktop/build -DCMAKE_PREFIX_PATH=C:\Qt\6.7.0\msvc2019_64
cmake --build desktop/build --config Release
```

Run the EXE from `desktop/build` (or `Release/`).  
**No Authenticode certificate needed** for local/friends testing. SmartScreen may warn on unsigned binaries — expected without a paid cert.

macOS builds need a Mac (deferred). See also `docs/FREE_DISTRIBUTION.md`.
