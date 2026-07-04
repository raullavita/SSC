# SSC — Super Secure Chat

End-to-end encrypted messenger for **installed clients only** (Android + Windows desktop).  
Production site: https://www.supersecurechat.com · API: https://api.supersecurechat.com

## Status

| Layer | State |
|-------|--------|
| **Engines 1–13** | Complete (retention, Signal, messaging, platform scaffolds, no inside AI) |
| **Engine 14** | FCM push + mediasoup SFU deploy scripts |
| **Production API** | Live on Cloud Run (Mongo Atlas, Redis, push ready) |
| **Website** | Landing-only — no web chat |
| **Downloads** | Not hosted yet — build locally (see below) |

Verify gates: `cd backend && python scripts/run_engine13_gate.py`

## Quick start (local dev)

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
yarn install
copy .env.example .env
yarn start
```

- API: http://localhost:8000/api/health  
- UI: http://localhost:3000

## Build installed clients (local)

```powershell
.\scripts\build_electron.ps1   # Windows installer → electron\dist\
.\scripts\build_android.ps1    # Android APK → android\app\build\outputs\apk\release\
```

## Deploy (maintainer)

```powershell
.\scripts\deploy_hosting.ps1      # Firebase Hosting (landing site)
.\scripts\deploy_cloud_run.ps1    # Cloud Run API
.\scripts\validate_deploy.ps1     # Pre-flight checks
```

Secrets stay local — see `.env.example` files. Never commit `cloudrun-env.yaml`, `ssc-firebase-key.json`, or `atlas-credentials.env`.

## Architecture

Policy charters live in `memory/`. Development proceeds engine-by-engine with gate scripts under `backend/scripts/`.

## Tests

```powershell
cd backend && .\venv\Scripts\python.exe -m pytest tests/ -q
cd frontend && yarn test:ci
```