# Free distribution path (no paid stores / no Mac required)

You can build, sign, and share SSC **without** Apple Developer, Google Play, or paid code-signing certificates.

## What you can do free

| Platform | How users install | Cost |
|----------|-------------------|------|
| **Android** | Sideload APK / Firebase App Distribution | Free (own keystore via `keytool`) |
| **Windows** | `.exe` installer (debug or self-signed later) | Free for local/test; paid cert only for SmartScreen trust |
| **Website / API** | Your existing hosting | As today |
| **iOS** | Needs Mac + Apple account for device install | **Deferred** until you have a Mac |
| **Play / App Store** | Paid developer accounts | **Deferred** |

## Android (recommended free path)

### 1. Free release keystore (once)

```powershell
.\scripts\create_android_keystore.ps1
```

Creates `%USERPROFILE%\.ssc\ssc-release.jks` + `android-signing.env`.  
**Back up both.** Losing them means users cannot update the same install identity.

This is **not** Google Play signing. It is a normal self-managed APK signature (free).

### 2. Build installable APK

```powershell
.\scripts\build_android.ps1
```

Output: `android\app\build\outputs\apk\release\SSC-0.4.0.apk` (or debug via Gradle).

### 3. Install on phone (sideload)

1. Copy APK to the phone (USB, Drive, website download).
2. Enable **Install unknown apps** for the file manager / browser.
3. Open the APK and install.

Optional free tester path (if Firebase project is already set up):

```powershell
.\scripts\distribute_android.ps1
```

### 4. Updates

Rebuild with the **same** keystore and higher `versionCode`. Users reinstall/update the APK manually until Play is paid later.

## Windows desktop (free for now)

- **Native path:** Qt app under `desktop/` — same dark UI language as Android Compose + libsignal worker.
- **No paid Authenticode required** for you to build and run locally.
- Windows SmartScreen may warn on unsigned EXEs — normal without a paid cert. Users can choose “More info → Run anyway” for personal installs.

```powershell
# Preferred (installs/uses Qt via aqt — see docs/WINDOWS_CLIENT.md):
.\scripts\build_desktop_windows.ps1
# Output: dist\windows-qt\SSC-Desktop-0.4.0.exe

# Manual cmake when Qt 6 is installed:
cmake -S desktop -B desktop/build -DCMAKE_PREFIX_PATH=C:\Qt\6.x\msvc2019_64
cmake --build desktop/build --config Release
```

## Explicitly not required right now

- Google Play Console fee  
- Apple Developer Program  
- macOS / Xcode (iOS client sources can stay in repo until you have a Mac)  
- Commercial code-signing certificates  

## Security note

Free self-signed APKs are fine for friends/family testing. For public trust at scale, Play signing + review still helps later — when you choose to pay.

## Product architecture (unchanged)

Native only: Android Compose · iOS SwiftUI (later) · Qt desktop · no WebView/Electron product UI.  
See `memory/NATIVE_CLIENT_CHARTER.md`.

## In-app free tools (no store)

- **Backup export / share** — Settings → Local backup → Export/share (system share sheet)
- **Backup import** — same screen, pick a `.sscbackup` file
- **Device link token** — Settings → Create link token (share deep link string freely)
- **Firebase App Distribution** (optional free tier) — `.\scripts\distribute_android.ps1` if project is already wired
