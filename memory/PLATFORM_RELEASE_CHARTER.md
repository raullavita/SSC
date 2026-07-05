# SSC Platform Release Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 11 — Platform Release + SFU Wiring

## Scope

Engine 11 delivers **local builds only** — no live deploy to Firebase, Cloud Run, or Play Store.

| Platform | Artifact | Crypto |
|----------|----------|--------|
| Windows/macOS/Linux | Electron installer (`electron-builder`) | `@signalapp/libsignal-client` v0.96.4 via IPC |
| Android | Release APK (`gradle assembleRelease`) | `libsignal-android` v0.96.4 + WebView shell |

## Electron

- `electron/libsignalSession.js` — file-backed ProtocolStore in main process
- `electron/preload.js` — `window.sscCrypto` IPC bridge
- `scripts/build_electron.ps1` — builds CRA frontend then packages Electron

## Android

- `android/.../ApiClient.kt` — injects `X-SSC-Client: android/0.2.0/2`
- `android/.../MainActivity.kt` — WebView loads production web shell
- `scripts/build_android.ps1` — local APK build

## SFU (mediasoup)

- `sfu-server/roomManager.js` + `wsHandler.js` — full signaling
- `backend/core/sfu_client.py` — provisions rooms via `POST /internal/rooms`
- `frontend/src/calls/sfuSession.js` — `mediasoup-client` join/produce/consume

## Environment

```env
SSC_SFU_ENABLED=true
SSC_SFU_WS_URL=ws://localhost:4443
SSC_SFU_INTERNAL_URL=http://localhost:4443
SSC_SFU_INTERNAL_SECRET=ssc-sfu-dev-secret
```

## Gate

Engine 11 completes when `backend/scripts/run_engine11_gate.py` passes, including **step 11.12**.