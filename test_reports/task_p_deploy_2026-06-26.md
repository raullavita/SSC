# TASK P deploy evidence (2026-06-26)

## Automated deploys completed

| Item | Result |
|------|--------|
| Cloud Run API redeploy | **ssc-api-00017-whm** — includes change-password, CORS for supersecurechat.com |
| API health | `https://ssc-api-4jp3wuccwa-ew.a.run.app/api/health` — ok |
| change-password route | POST returns 401 without auth (route live) |
| Firebase Hosting | Deployed `frontend/build` to super-chat-b0992 |
| Build fixes | Removed duplicate imports in ChatHome.jsx, SettingsModal.jsx |

## cloud_run.env updates (local, not committed)

- `CORS_ORIGINS` extended with `www.supersecurechat.com`, `supersecurechat.com`, `super-chat-b0992.web.app`

## TASK P founder actions still required

| ID | Action | Status |
|----|--------|--------|
| P.1 | Create Cloudflare Turnstile keys | Pending |
| P.2 | Add TURNSTILE_* to cloud_run.env + REACT_APP_TURNSTILE_SITEKEY, redeploy | Pending |
| P.3 | Map api.supersecurechat.com (Cloud Run console or `gcloud beta` after installing beta component) | Pending |
| P.4 | Google OAuth authorized domain + redirect URIs | Pending |
| P.5 | Optional API URL migration after P.3 | Pending |
| P.6 | TURN off-LAN device call proof | Pending |
| P.7 | Cloudflare Email Routing hello@ | Pending |
| P.8–P.10 | Code-sign, Play Console, GCP alerts | Deferred |

See `scripts/TASK_P_FOUNDER_STEPS.txt` for copy-paste steps.