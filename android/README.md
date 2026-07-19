# SSC Android — native Jetpack Compose

**Architecture (locked):** Pure native UI. **No WebView.** No React bundle in `assets/www`.

See `memory/NATIVE_CLIENT_CHARTER.md` and `memory/NATIVE_ANDROID_PARITY.md`.

## Stack

| Layer | Tech |
|-------|------|
| UI | Jetpack Compose + Material 3 |
| Crypto | `libsignal-android` 0.96.4 (`LibsignalSession`) |
| API | Kotlin `SscHttpClient` + Bearer session |
| Push | Firebase Cloud Messaging |
| Package | `com.supersecurechat.app` |

## Current milestone

- **A0–A3 foundation:** Login/register, conversation list, thread, 1:1 encrypt/send path, settings shell
- **Parity goal:** Full feature set vs former React installed app (checklist in `NATIVE_ANDROID_PARITY.md`)

## Build

```powershell
.\scripts\build_android.ps1
```

Or from `android/`:

```bat
gradlew.bat assembleRelease
```

APK: `android/app/build/outputs/apk/release/`

Requires Android SDK 35, JDK 17, Kotlin 2.2.x.

## What was removed

- WebView shell loading React from `assets/www`
- JS crypto bridges as the product path (`window.sscCrypto`)
- Electron/React as the Android UI source

Legacy bridge Kotlin classes may remain in-tree for reference during port; they are not used by `MainActivity`.

## Client identity

```
X-SSC-Client: android/0.4.0/15
X-SSC-Native-Bridge: v1
X-SSC-Device-Id: 1   (primary; linked devices later)
Authorization: Bearer <ws_token from login>
```

## Verify

```powershell
# Android compile + APK
cd android; .\gradlew.bat :app:assembleDebug

# Backend (from repo)
cd backend; python -m pytest tests -q
```

Last green: Compose `assembleDebug` OK · SFU room fan-out + video tiles · sfu tests green (v0.4.0 / build 15)

