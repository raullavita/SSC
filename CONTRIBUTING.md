# Contributing to SSC

Thank you for helping build Super Secure Chat. SSC is **AGPL-3.0** — contributions are welcome under the same license.

## Before you start

1. Read [SECURITY.md](SECURITY.md) and `memory/` charters.
2. Never commit secrets (`.env`, `cloudrun-env.yaml`, Firebase keys, Atlas creds).
3. SSC is **install-only** — chat runs in Android/Windows apps, not the public website.

## Help-wanted issues

- Contributions are **voluntary** (AGPL-3.0). We do not pay for issues, hire freelancers, or accept payment links (Stripe, crypto, AgentWork bots).
- **Commenting does not reserve an issue** — we do not assign from comments.
- Open **one focused PR** against `main`; we review all external code before merge.
- Spam or automated sales comments may be removed by maintainers.

## Development setup

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
yarn install
copy .env.example .env
yarn start
```

### Tests

```powershell
cd backend && .\venv\Scripts\python.exe -m pytest tests/ -q
cd frontend && yarn test:ci
```

## Engine gates

Security features are delivered engine-by-engine. Run the relevant gate before opening a PR:

```powershell
python backend/scripts/run_engine13_gate.py
```

## Pull requests

- Keep PRs focused (one feature or fix).
- Backend: `pytest tests/ -q` must pass.
- Frontend: `yarn test:ci` must pass.
- No production secrets or home IPs in the diff.

## Ideas and suggestions

Email: contact@supersecurechat.com