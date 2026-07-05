# SSC — Super Secure Chat

[![CI](https://github.com/raullavita/SSC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/raullavita/SSC/actions/workflows/ci.yml)

**Install-only E2E encrypted messenger** — Android + Windows desktop. No web chat on the public site.

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

We do **not** run inside AI on your messages. Translation is optional and user-controlled.

## Status

| Component | State |
|-----------|--------|
| Engines 1–13 | Complete (retention, Signal, messaging, no inside AI) |
| Engine 14 | FCM push + mediasoup SFU live (gate) |
| Auth | Email/password + Google OAuth |
| Chat | E2EE messages, reactions, files, voice notes |
| Calls | WebRTC mesh + SFU scaffold |
| Production API | Live |
| Website | Professional landing + OSS compliance at [supersecurechat.com](https://www.supersecurechat.com) |
| Latest release | [v0.3.0](https://github.com/raullavita/SSC/releases/tag/v0.3.0) |

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

## Build installed clients

```powershell
.\scripts\build_electron.ps1   # → electron\dist\SSC-Setup-*.exe
.\scripts\build_android.ps1    # → android\app\build\outputs\apk\release\
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Good first tasks: tests, docs, Android/Electron polish.

**Do not** post production secrets, API keys, or personal emails in issues or PRs.

## Security

Report vulnerabilities privately: [SECURITY.md](SECURITY.md) — not via public issues with exploit details.

## Architecture

Policy charters: `memory/`. Engine gates: `backend/scripts/run_engine*_gate.py`.

```powershell
cd backend
python scripts/run_engine13_gate.py
python -m pytest tests/ -q
```