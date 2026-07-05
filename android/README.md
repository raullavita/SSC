# SSC Android

Installed Android client — WebView shell with native `libsignal-android` crypto bridge (Step 5).

## Stack

- **WebView** loads `https://www.supersecurechat.com` (configurable via `SSC_WEB_URL` in `app/build.gradle.kts`)
- **`X-SSC-Client: android/0.2.0/2`** injected on all `/api/` requests from the WebView
- **`window.sscCrypto`** exposed via `SscNativeBridge` + `assets/ssc_crypto_bridge.js` — API matches Electron `preload.js`
- **libsignal-android 0.96.4** — file-backed stores under `filesDir/ssc-signal/` (sessions, prekeys, sender keys)

## Crypto API (window.sscCrypto)

| Method | Purpose |
|--------|---------|
| `configure` | Set `localUserId` / `deviceId` |
| `generatePreKeyBundle` | Upload prekeys to API |
| `establishSession` | X3DH session with peer bundle |
| `encryptMessage` / `decryptMessage` | 1:1 Signal protocol |
| `encryptBytes` | Attachment encryption |
| `computeSafetyNumber` | Safety number fingerprint |
| `wipeLocalData` | Panic wipe local crypto state |
| `configureGroupKeys` + group methods | Group sender keys (Step 2 parity) |

## Build

```bash
cd android
./gradlew assembleRelease
```

APK: `app/build/outputs/apk/release/app-release.apk`

Requires Android SDK 35, JDK 17, Kotlin 2.2.20, and `local.properties` with `sdk.dir`.

Dependencies resolve from [Signal's Maven repository](https://build-artifacts.signal.org/libraries/maven/) (`settings.gradle.kts`).

## Notes

- Production web builds with `REACT_APP_SSC_REQUIRE_LIBCRYPTO=true` require `window.sscCrypto` — the native bridge satisfies `cryptoPolicy.js`.
- `@JavascriptInterface` calls run on a background executor; results resolve via Promise-based `ssc_crypto_bridge.js`.