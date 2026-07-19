# Electron / WebView hybrid — retired

**Status:** Not the product path. Do not ship Electron builds as SSC messenger.

## Product clients (current)

| Platform | Path | Notes |
|----------|------|--------|
| **Android** | `android/` Jetpack Compose + libsignal | Primary free-distribution APK |
| **Backend** | `backend/` FastAPI | Production API |
| **SFU** | `sfu-server/` mediasoup | Group/call media |
| **iOS** | `ios/` SwiftUI scaffold | Incomplete; no Xcode project in CI |
| **Desktop** | `desktop/` Qt scaffold | Memory-only session token; not E2EE-complete |

## Why Electron remains in the tree

- Historical `electron/` sources, `latest-builds` artifacts, and release scripts reference 0.3.x installers.
- Some ops scripts still mention Electron artifact names for backward-compatible GitHub release URLs.
- **Native Android** is the only supported end-user messenger for free sideload (`docs/FREE_DISTRIBUTION.md`).

## Do not

- Treat `electron/dist` or `SSC-Setup-*.exe` as current product
- Re-enable WebView messenger UI in Android (`assets/www` removed; Compose only)
- Point store listings or landing “Download” at Electron without an explicit revive project

## Revive (if ever)

1. New design doc + security review (E2EE, auto-update signing)
2. Align version with `backend/core/release_policy.py` (`RELEASE_VERSION`)
3. Remove dual product messaging from README / landing
