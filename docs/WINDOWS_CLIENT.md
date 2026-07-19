# SSC Windows — native Qt client (Android parity)

**Product path:** Qt Quick / QML under `desktop/` — **not Electron**.

| Concern | Implementation |
|---------|----------------|
| **UI** | Qt Quick Material, same dark palette as Android Compose (`#0B141A`, `#00A884`, …) |
| **Flows** | Login / register, chat list, thread, settings, prekeys, E2EE send/receive |
| **API** | `windows/0.4.0/15` + `X-SSC-Native-Bridge: v1` |
| **Crypto** | Node **crypto-worker** + `@signalapp/libsignal-client` **0.96.4** (same target as Android) |
| **Electron** | **Not** the Windows product. Do not ship `SSC-Setup-*.exe` as the desktop messenger. |

Android sources are intentionally untouched.

## Build

Prerequisites: **Node.js 20+**, **CMake**, **Qt 6.7+ (mingw or MSVC)**.

```powershell
# One-time Qt install (example: aqt)
python -m pip install aqtinstall
python -m aqt install-qt windows desktop 6.7.3 win64_mingw -O C:\Users\smash\ssc\.ssc-tools\Qt
python -m aqt install-tool windows desktop tools_mingw1310 -O C:\Users\smash\ssc\.ssc-tools\Qt

$env:SSC_QT_PREFIX = "C:\Users\smash\ssc\.ssc-tools\Qt\6.7.3\mingw_64"
$env:PATH = "C:\Users\smash\ssc\.ssc-tools\Qt\Tools\mingw1310_64\bin;$env:PATH"

.\scripts\build_desktop_windows.ps1
```

Output: `dist\windows-qt\SSC-Desktop-0.4.0.exe` (+ `crypto-worker/`).

Runtime ships a **portable Node** under `runtime/node/node.exe` (no system Node install required).
Crypto-worker + libsignal live under `crypto-worker/`.

## Feature parity (vs Android Compose)

| Area | Windows Qt |
|------|------------|
| Login / register + Turnstile | Yes |
| Google OAuth start | Yes (browser) |
| Recovery | Yes |
| E2EE 1:1 messages | Yes (libsignal 0.96.4) |
| Reply / delete / reactions | Yes |
| Typing + read + pin/mute | Yes |
| Groups create / members / leave / dissolve | Yes |
| Friend requests | Yes |
| Devices + link token | Yes |
| Privacy + username + panic | Yes |
| Stories feed + post + delete | Yes |
| Polls | Yes |
| Cloud backup API | Yes (desktop envelope) |
| Broadcast lists | Yes |
| Realtime WebSocket | Yes |
| Call signaling + WebRTC media worker | Yes (audio/video 1:1 via @roamhq/wrtc) |
| Group sender-key multi encrypt | Yes (dist + encrypt/decrypt) |
| Multi-device Sesame encrypt | Yes (`device_ciphertexts` map) |
| Sesame decrypt retry-request | Yes |
| Edit message | Yes |
| Local message search (SQLite) | Yes |
| Safety number | Yes |
| Sealed sender toggle | Yes |
| SFU room provision + join (produce/consume) | Yes (mediasoup WS + DTLS + audio produce + consume) |
| File download/open | Yes |
| Voice notes (record + `[voice:id]`) | Yes (WinMM WAV → encrypted file) |

## Android ↔ Windows

1. Android Compose APK 0.4.0  
2. Run from `dist/windows-qt/` (EXE + runtime + crypto-worker + media-worker)  
3. Two accounts → direct chat → both directions  

### Suggested A↔W checklist

| # | Flow | Expect |
|---|------|--------|
| 1 | Login both (Android + Windows) | Prekeys upload; WS online |
| 2 | Direct message each way | Decrypt plaintext bubbles |
| 3 | Reply / react / edit / delete | UI updates both sides |
| 4 | File attach Windows → Android | `[file]` open works |
| 5 | Voice note Windows 🎤 | `[voice:id]`; open plays WAV |
| 6 | 1:1 audio 📞 / video 📹 | Ring + connect state |
| 7 | Safety number | Same digits both sides |
| 8 | Group SFU (Windows hosts **SFU**) | Auto-join; Android joins room |
| 9 | Sealed sender toggle | Settings switch persists |

## Why a small Node worker?

libsignal’s supported desktop binding for 0.96.x is the official Node package. Qt UI stays native; the worker only runs Signal Protocol. **Not** an Electron UI shell. Portable Node is bundled under `runtime/node/`.

See also: `desktop/README.md`, `docs/ELECTRON_RETIRED.md`.
