# SSC — Super Secure Chat

End-to-end encrypted messenger for **installed clients only** (Android, Windows/Mac desktop).

## Status

**Phase 0** — monorepo scaffold, health API, landing page, CI skeleton.

## Quick start

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
yarn start
```

- API: http://localhost:8000/api/health  
- UI: http://localhost:3000

## Architecture

See `memory/` for security charters. Build proceeds engine-by-engine (1 → 5 → 8 → 9+).