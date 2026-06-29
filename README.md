# SSC — Super Secure Chat

[![CI](https://github.com/raullavita/SSC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/raullavita/SSC/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Install only](https://img.shields.io/badge/chat-install--only%20(Android%20%2B%20Desktop)-0A0A0A)](CONTRIBUTING.md)

**E2E-encrypted ephemeral messaging** — 24h auto-delete, Signal/libsignal on installed clients, WebRTC calls, groups, stories, panic wipe.

| | |
|---|---|
| **Product** | Install-only — **Android APK** + **Windows/Mac desktop**. Browser-tab chat is **not** supported (`InstalledClientGate`). |
| **License** | [AGPL-3.0](LICENSE) — libsignal in the APK requires source availability when you distribute builds. |
| **Status** | Active development · solo maintainer · **help welcome** |
| **Latest desktop** | v1.0.12 (see [Releases](https://github.com/raullavita/SSC/releases)) |

---

## Help wanted

Looking for contributors — no payment expected, credit in commit history under AGPL.

**Good places to start:**

- Tests (`frontend` Jest, `backend` pytest)
- Docs (setup from a clean clone, architecture diagrams)
- Android / Electron **libsignal** integration
- WebRTC signaling and call reliability
- i18n (EN / ES / RO)
- Security review — see [SECURITY.md](SECURITY.md)

**How to contribute:** [CONTRIBUTING.md](CONTRIBUTING.md) · open an [Issue](https://github.com/raullavita/SSC/issues/new/choose) · [Discussions](https://github.com/raullavita/SSC/discussions) for questions

**Do not** post production secrets, API keys, or personal emails in issues or PRs.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, MongoDB, Redis, WebSockets |
| Frontend | React 19, Capacitor (Android), Electron (desktop) |
| E2E | Signal `signal_v1` (PQXDH) + legacy RSA migration; libsignal **0.96.4** on installed clients |
| Calls | WebRTC + encrypted signaling |

Deep dives: [SECURITY_MODEL.md](memory/SECURITY_MODEL.md) · [SSC-ROADMAP.md](memory/SSC-ROADMAP.md) · [PRD.md](memory/PRD.md)

---

## Contributor quick start (local)

Requires: **Docker**, **Node 18+**, **Python 3.11+**, **Yarn**.

```powershell
git clone https://github.com/raullavita/SSC.git
cd SSC
docker compose up -d

cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env    # set MONGO_URL, JWT_SECRET (dev values only)
.\venv\Scripts\python.exe -m uvicorn server:app --reload --port 8000

cd ..\frontend
yarn install
copy .env.example .env    # REACT_APP_BACKEND_URL=http://localhost:8000
yarn test:ci
```

Backend tests: `cd backend && .\venv\Scripts\python.exe -m pytest tests/ -q`

---

## Build installed clients

| Platform | Command | Output |
|----------|---------|--------|
| Windows desktop | `.\SSC-BUILD-DESKTOP-WIN.bat` | `frontend/desktop/dist/SSC-Setup-*.exe` |
| Android release | `.\SSC-BUILD-APK.bat` | signed APK (needs local keystore + `google-services.json`) |
| macOS desktop | `./SSC-BUILD-DESKTOP-MAC.sh` | `.dmg` (on macOS) |

Production builds need gitignored secrets — copy from `*.example` files. See [SECURITY.md](SECURITY.md).

---

## Project layout

```
SSC/
├── backend/          # API, WebSocket, Signal prekey relay
├── frontend/         # React UI, Capacitor Android, Electron desktop
├── memory/           # Architecture charters & roadmap
├── scripts/          # Deploy helpers (secrets stay local)
├── CONTRIBUTING.md
└── SECURITY.md
```

---

## Environment files (never commit real values)

| File | Purpose |
|------|---------|
| `backend/.env.example` | Mongo, JWT, OAuth, TURN, VAPID, FCM |
| `backend/cloud_run.env.example` | Production deploy template |
| `frontend/.env.example` | API URL, Turnstile site key |
| `scripts/firebase_testers.txt.example` | App Distribution emails (copy to gitignored `firebase_testers.txt`) |

---

## Security

Report vulnerabilities privately: [SECURITY.md](SECURITY.md) — do not open public issues with exploit details.

---

## License

Copyright (C) 2026 SSC contributors. Licensed under [GNU AGPL v3](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for libsignal and other dependencies.