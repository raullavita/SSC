# iOS shell (WKWebView)

The iOS app is a **WebView shell** matching the Android pattern. Production E2E crypto requires wiring **libsignal-swift** into `SscNativeBridge.swift`.

## Current state

- `SscNativeBridge.swift` returns `ios_crypto_stub` until native crypto is integrated.
- Do not ship iOS downloads for real users until libsignal-swift is wired and tested.

## Build

```bash
./scripts/build_ios.sh
```

Requires macOS with Xcode.