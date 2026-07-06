# iOS shell (WKWebView)

The iOS app is a **WebView shell** matching the Android pattern. Phase 3 wires **libsignal-swift** via `SscCryptoService` + encrypted Keychain-backed stores.

## Current state (Phase 3)

- `LibsignalSession.swift` + `SscProtocolStores.swift` — libsignal-swift protocol stores
- `SscSecureStore.swift` — Keychain-protected on-disk JSON encryption
- `SscNativeBridge.swift` — async crypto bridge for `window.sscCrypto`
- `SscDeviceAttest.swift` — DeviceCheck attestation header (HMAC token)
- Add **LibSignalClient** Swift package in Xcode: `https://github.com/signalapp/libsignal` (0.96.4)

## Build

```bash
./scripts/build_ios.sh
```

Requires macOS with Xcode. Create `ios/SuperSecureChat.xcodeproj` from sources if missing, then add LibSignalClient SPM dependency.