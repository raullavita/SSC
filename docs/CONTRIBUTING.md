# Contributing to SSC

## Development setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd frontend
yarn install
yarn start
```

## Engine gates

Each security engine has a gate script in `backend/scripts/`. Run gates before merging engine work.

See [SECURITY.md](./SECURITY.md) for charter references.