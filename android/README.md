# SSC Android

Installed Android client — polished WebView shell with native `libsignal-android` crypto bridge (Step 5 + Step 17).

## Stack

- **WebView** loads the **bundled React app** from `assets/www/` (same installed UI as Windows Electron — sign-in on launch, not the marketing site)
- **`X-SSC-Client: android/0.3.0/4`** injected on all `/api/` requests from the WebView
- **`window.sscCrypto`** exposed via `SscNativeBridge` + `assets/ssc_crypto_bridge.js` — API matches Electron `preload.js`
- **`window.sscTranslate`** exposed via `SscNativeBridge` + `assets/ssc_translate_bridge.js` — ML Kit on-device translation (no text leaves device)
- **libsignal-android 0.96.4** — file-backed stores under `filesDir/ssc-signal/` (sessions, prekeys, sender keys)

## Native shell polish (Step 17)

| Feature | Details |
|---------|---------|
| Splash screen | SSC dark theme + animated icon (`Theme.SSC.Splash`) |
| Deep links | `ssc://link-device`, `ssc://add/{username}`, HTTPS app links |
| Pull to refresh | `SwipeRefreshLayout` around the WebView |
| Offline retry | Native error panel with retry when the main frame fails |
| File chooser | Backup restore + attachments via `onShowFileChooser` |
| Edge-to-edge | Dark status/navigation bars matching web shell |

Injected globals for the web app:

- `window.__SSC_ANDROID_SHELL = '1'`
- `window.__SSC_ANDROID_FEATURES = 'splash_screen,deep_links,...'`

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

```powershell
.\scripts\build_android.ps1
```

This builds the React bundle (`REACT_APP_SSC_PLATFORM=android`, `LANDING_ONLY=false`), copies it into `app/src/main/assets/www/`, then runs Gradle → `SSC-0.3.0.apk`.

## Firebase App Distribution (testers)

```powershell
.\scripts\distribute_android.ps1
```

APK: `app/build/outputs/apk/release/app-release.apk`

Requires Android SDK 35, JDK 17, Kotlin 2.2.20, and `local.properties` with `sdk.dir`.

## Release signing (free — no Play Store)

```powershell
.\scripts\create_android_keystore.ps1
.\scripts\build_android.ps1
```

- Keystore: `%USERPROFILE%\.ssc\ssc-release.jks` (never commit)
- Credentials: `%USERPROFILE%\.ssc\android-signing.env` (never commit)
- `build_android.ps1` loads signing env automatically

**Back up** the `.jks` file and password. Losing either blocks future updates for users who installed that APK.

Sideload only (no Play Store yet). Enable “Install unknown apps” on the device when installing.

Dependencies resolve from [Signal's Maven repository](https://build-artifacts.signal.org/libraries/maven/) (`settings.gradle.kts`).

## Notes

- Production web builds with `REACT_APP_SSC_REQUIRE_LIBCRYPTO=true` require `window.sscCrypto` — the native bridge satisfies `cryptoPolicy.js`.
- `@JavascriptInterface` calls run on a background executor; results resolve via Promise-based `ssc_crypto_bridge.js`.