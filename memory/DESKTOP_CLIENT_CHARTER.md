# Desktop client charter — Windows + Mac (Engine 10)

**Version:** 1.0  
**Effective:** 2026-06-24  
**Scope:** Installed SSC clients for Windows and macOS with official libsignal (Node native)

---

## 1. Product decision (founder)

SSC is **installed-clients only** for secure chat:

| Surface | Product? | Crypto |
|---------|----------|--------|
| **Android APK** | ✅ | libsignal native |
| **Windows desktop** | ✅ | libsignal via Electron + `@signalapp/libsignal-client` |
| **Mac desktop** | ✅ | Same Electron build (`.dmg` on macOS) |
| **iOS** | ⬜ Deferred | Scaffold exists; needs Mac + $99/yr |
| **Web / PWA in browser** | ❌ **Not a product** | RSA legacy — dev/landing only |

Engine **8.10 (Signal in browser WASM)** is **retired** — replaced by Engine 10 desktop (Signal Desktop model).

---

## 2. Architecture

```
React UI (frontend/build)
    ↓ file:// in Electron BrowserWindow
preload.mjs → window.sscDesktop
    ↓ IPC
main.mjs → libsignal bridge (Node @signalapp/libsignal-client 0.96.4)
    ↓
Persistent store: %APPDATA%/SSC/signal-store/ (Windows) · ~/Library/Application Support/SSC/ (Mac)
```

Session auth: **memory JWT + encrypted device wrap** (same as Android APK — Engine 5 + TASK B).

---

## 3. Build workflow

### Windows (founder laptop)

```powershell
cd C:\Users\smash\SSC-main\frontend
yarn build:desktop
cd desktop
yarn install
yarn build:win
```

Output: `frontend/desktop/dist/SSC Setup *.exe`

### macOS (requires Mac)

```bash
cd frontend
yarn build:desktop
cd desktop
yarn install
yarn build:mac
```

Output: `frontend/desktop/dist/SSC-*.dmg`

---

## 4. Parity with Android

| Feature | Android | Desktop target |
|---------|---------|----------------|
| libsignal 0.96.4 (PQXDH) | ✅ | ✅ |
| 1:1 X3DH + ratchet | ✅ | ✅ |
| Group Sender Keys | ✅ | ✅ |
| Stories encryption | ✅ | ✅ |
| Call signaling encrypt | ✅ | ✅ |
| On-device translate | ML Kit | ⬜ OS APIs later |
| Push | FCM | ⬜ Deferred (desktop tray later) |

---

## 5. Engine 10 steps

| Step | Description | Status |
|------|-------------|--------|
| 10.1 | Charter + policy + Electron scaffold | ✅ |
| 10.2 | libsignal IPC bridge (full plugin parity) | ✅ |
| 10.3 | Windows installer (electron-builder) | ✅ |
| 10.4 | Mac build config (dmg on macOS) | ✅ |
| 10.5 | Engine 10 gate + tests | ✅ |

---

## 6. AGPL

Desktop conveys `@signalapp/libsignal-client` (AGPL-3.0). Source offer: public GitHub + in-app Settings → Open source (same as Android).