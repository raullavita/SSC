# SSC — Super Secure Chat

[![CI](https://github.com/raullavita/SSC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/raullavita/SSC/actions/workflows/ci.yml)

**Install-only E2E encrypted messenger** — Android + Windows desktop.

| | |
|---|---|
| **Website** | https://www.supersecurechat.com (info + downloads) |
| **API** | https://api.supersecurechat.com |
| **Source** | https://github.com/raullavita/SSC |
| **License** | [AGPL-3.0](LICENSE) — source must remain available to network users |
| **Contact** | contact@supersecurechat.com |

## Open source & AGPL compliance

SSC is **open source** under the [GNU Affero General Public License v3.0](LICENSE). Anyone interacting with a modified SSC service over a network may request the corresponding source code.

We use **[Signal libsignal](https://github.com/signalapp/libsignal)** (`@signalapp/libsignal-client` on desktop, `libsignal-android` on Android) for end-to-end encryption. libsignal is **AGPL-3.0** — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full attribution and dependency licenses.

- **Repository:** https://github.com/raullavita/SSC  
- **License:** [LICENSE](LICENSE)  
- **Third-party notices:** [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)  
- **libsignal upstream:** https://github.com/signalapp/libsignal  

## Open-source stack (we build on OSS — not reinvent)

SSC uses maintained open-source projects for heavy lifting:

| Layer | OSS project |
|-------|-------------|
| **E2E crypto** | [Signal libsignal](https://github.com/signalapp/libsignal) (`@signalapp/libsignal-client`, `libsignal-android`) |
| **Group calls (SFU)** | [mediasoup](https://mediasoup.org/) |
| **Push** | [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) (FCM) |
| **1:1 calls** | WebRTC (browser/Electron) + encrypted signaling |
| **API** | [FastAPI](https://fastapi.tiangolo.com/) + Motor (MongoDB) + Redis |
| **Desktop** | [Electron](https://www.electronjs.org/) + electron-builder |
| **Frontend** | React 18 |

Translation is optional and user-controlled.

## Status

| Component | State |
|-----------|--------|
| Engines 1–13 | Complete (retention, Signal, messaging) |
| Engine 14 | FCM push + mediasoup SFU live (gate) |
| Auth | Email/password + Google OAuth |
| Chat | E2EE messages, reactions, files, voice notes |
| Calls | WebRTC mesh + SFU scaffold |
| Production API | Live |
| Website | Professional landing + OSS compliance at [supersecurechat.com](https://www.supersecurechat.com) |
| Latest release | [v0.3.1 (build 12)](https://github.com/raullavita/SSC/releases/tag/v0.3.1) — same files as [supersecurechat.com](https://www.supersecurechat.com#download) |

## Quick start (local dev)

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --reload --port 8000

# Frontend
cd frontend
yarn install
copy .env.example .env
yarn start
```

- UI: http://localhost:3000  
- API health: http://localhost:8000/api/health

## Client architecture (one UI)

| Platform | Shell | UI |
|----------|-------|-----|
| Windows / macOS | Electron | Shared React installed-client bundle |
| Android | WebView + native bridges | **Same** React bundle (`assets/www/`) |
| Website | Firebase Hosting | Landing + downloads |

Native code on mobile/desktop is limited to crypto (libsignal), OAuth, push hooks, and device APIs — not a second chat UI.

## Build installed clients

```powershell
.\scripts\rebuild_clients.ps1   # Electron + Android (recommended)
.\scripts\build_electron.ps1     # → electron\dist\SSC-Setup-0.3.1.exe
.\scripts\build_android.ps1      # → android\app\build\outputs\apk\release\SSC-0.3.1.apk
```

Local API override:

```powershell
$env:REACT_APP_API_URL = "http://YOUR_LAN_IP:8000"
.\scripts\rebuild_clients.ps1
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). **Help wanted** issues are open — tests, docs, Android/Windows polish.

1. Pick an [open help-wanted issue](https://github.com/raullavita/SSC/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
2. Fork → one focused PR against `main`
3. Ensure `pytest` and `yarn test:ci` pass

Commenting on an issue does **not** reserve it. All external PRs are reviewed before merge.

**Do not** post production secrets, API keys, or personal emails in issues or PRs.

## Reviews & feedback

Installed SSC? Tell us what works and what does not:

- **Website:** https://www.supersecurechat.com — **Reviews & feedback** section
- **GitHub:** [Issues](https://github.com/raullavita/SSC/issues/new/choose) for bugs and feature requests

## Security

Report vulnerabilities privately: [SECURITY.md](SECURITY.md) — not via public issues with exploit details.

## Architecture

Policy charters: `memory/`. Engine gates: `backend/scripts/run_engine*_gate.py`.

```powershell
cd backend
python scripts/run_engine13_gate.py
python -m pytest tests/ -q
```