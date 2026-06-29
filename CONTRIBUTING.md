# Contributing to SSC

SSC is **install-only** (Android APK + Windows/Mac desktop). Browser-tab chat is intentionally blocked. See `InstalledClientGate.jsx`.

## How to help (no payment expected — thank you)

1. Read this file and [SECURITY.md](SECURITY.md).
2. Pick a task or open **[Help wanted](https://github.com/raullavita/SSC/issues/new?template=help_wanted.yml)** if you are unsure where to start.
3. **Fork** → branch → **Pull Request** (use the PR template).
4. For bugs use the [bug report template](https://github.com/raullavita/SSC/issues/new?template=bug_report.yml).
5. Questions → [Discussions](https://github.com/raullavita/SSC/discussions) (not Issues).

Architecture: `memory/SECURITY_MODEL.md` · `memory/SSC-ROADMAP.md`

**License:** By contributing, you agree your work is licensed under [AGPL-3.0](LICENSE) (same as the project). You are not entitled to payment unless we sign a separate written agreement.

## Local setup (summary)

```powershell
docker compose up -d
cd backend && python -m venv venv && .\venv\Scripts\pip install -r requirements.txt
copy .env.example .env   # fill MONGO_URL, JWT_SECRET
cd ..\frontend && yarn install && copy .env.example .env
```

See `README.md` for LAN APK and desktop builds.

## Tests

All automated tests live under **`backend/tests/`** (there is no separate top-level `tests/` package).

- Frontend: `cd frontend && yarn test:ci`
- Backend (unit/policy): `cd backend && python -m pytest tests/ -q --ignore=tests/test_ssc_backend.py --ignore=tests/test_ssc_iteration2.py --ignore=tests/test_ssc_iteration3.py`
- Backend (full + live API): start `docker compose up -d`, run `uvicorn server:app --port 8000`, then `python -m pytest tests/ -q`

## Before you PR
- No secrets, personal emails, or home LAN IPs in the diff
- Match existing code style; small PRs are easier to review

## License

By contributing, you agree your contributions are licensed under the same terms as the project (AGPL-3.0). See `LICENSE`.