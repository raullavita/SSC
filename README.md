# SSC — Super Secure Chat

[![CI](https://github.com/raullavita/SSC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/raullavita/SSC/actions/workflows/ci.yml)

**Open-source, install-only, end-to-end encrypted messenger.**  
Primary product client: **native Android (Jetpack Compose + libsignal)** — no WebView.

| | |
|---|---|
| **Website** | https://www.supersecurechat.com (info + downloads only) |
| **API** | https://api.supersecurechat.com |
| **Source** | https://github.com/raullavita/SSC |
| **License** | [AGPL-3.0](LICENSE) |
| **Contact** | contact@supersecurechat.com |

## What is SSC?

SSC is a privacy-first chat app: messages and call signaling are encrypted on your device with **Signal’s libsignal** before they hit the server. The API stores **ciphertext only** — it cannot read your chats.

- **Native Android** is the main product path (Compose UI, multi-device E2EE, groups, calls, SFU).
- **Free distribution** — sideload APK with your own keystore; no Play Store fee required ([docs/FREE_DISTRIBUTION.md](docs/FREE_DISTRIBUTION.md)).
- **Website** is landing + downloads only — the messenger does **not** run in the browser.
- **iOS (SwiftUI)** and **desktop (Qt Quick)** scaffolds exist; production E2EE on those platforms is next.

## Open source & AGPL

SSC is **AGPL-3.0**. We use **[Signal libsignal](https://github.com/signalapp/libsignal)** (`libsignal-android` on Android). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Anyone interacting with a **modified** SSC network service may request corresponding source.

## Stack (OSS first)

| Layer | Project |
|-------|---------|
| **E2E crypto** | [Signal libsignal](https://github.com/signalapp/libsignal) |
| **Group calls (SFU)** | [mediasoup](https://mediasoup.org/) + coturn TURN |
| **API** | [FastAPI](https://fastapi.tiangolo.com/) + MongoDB + Redis |
| **Android** | Kotlin + Jetpack Compose + OkHttp + WebRTC |
| **Push** | Firebase Cloud Messaging |
| **Website** | React landing (Firebase Hosting) |

## Status (v0.4.0 / build 15)

| Component | State |
|-----------|--------|
| **Android Compose** | Active — auth, E2EE 1:1 + groups, reactions, polls, stories, files/voice, privacy, backup, FCM |
| **Calls** | 1:1 mesh WebRTC + **production mediasoup SFU** + TURN |
| **API** | Live at api.supersecurechat.com |
| **Website** | Landing + OSS compliance at [supersecurechat.com](https://www.supersecurechat.com) |
| **iOS / Qt desktop** | Native scaffolds (no WebView product path) |
| **Electron / WebView hybrid** | Retired as product messenger |

Parity notes: [`memory/NATIVE_ANDROID_PARITY.md`](memory/NATIVE_ANDROID_PARITY.md) · SFU ops: [`docs/LIVE_SFU_HARDEN.md`](docs/LIVE_SFU_HARDEN.md)

## Quick start (local dev)

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --reload --port 8000

# Website / React landing (optional)
cd frontend
yarn install
yarn start
```

- Landing/dev UI: http://localhost:3000  
- API health: http://localhost:8000/api/health  

## Build free Android APK (no store fees)

```powershell
.\scripts\create_android_keystore.ps1   # once
.\scripts\build_android.ps1             # release APK for sideload
# or: cd android; .\gradlew.bat :app:assembleDebug
```

See [docs/FREE_DISTRIBUTION.md](docs/FREE_DISTRIBUTION.md) and [android/README.md](android/README.md).

## Client architecture (locked — native only)

| Platform | UI | Status |
|----------|-----|--------|
| **Android** | Jetpack Compose | **Active** (0.4.0 / 15) |
| **iOS** | SwiftUI | Scaffold under `ios/` |
| **Windows / macOS** | Qt Quick | Scaffold under `desktop/` |
| **Website** | React | Landing only |

See [`memory/NATIVE_CLIENT_CHARTER.md`](memory/NATIVE_CLIENT_CHARTER.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

1. Pick a [help-wanted issue](https://github.com/raullavita/SSC/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
2. Fork → focused PR against `main`
3. `pytest` (backend) and relevant client checks

**Do not** post production secrets, API keys, or personal data in issues/PRs.

## Security

Report vulnerabilities per [SECURITY.md](SECURITY.md) / [docs/SECURITY.md](docs/SECURITY.md).

## License

[AGPL-3.0](LICENSE) · [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
