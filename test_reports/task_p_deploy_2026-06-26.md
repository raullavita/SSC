# TASK P deploy evidence (2026-06-26)

## Automated deploys completed

| Item | Result |
|------|--------|
| Cloud Run API redeploy | **ssc-api-00018-gnx** — Turnstile keys in env |
| API health | `https://ssc-api-4jp3wuccwa-ew.a.run.app/api/health` — 200 |
| API custom domain | `https://api.supersecurechat.com/api/health` — 200 |
| Turnstile `/api/config` | `turnstile_sitekey` present; egress `turnstile.enabled: true` |
| Firebase Hosting | Rebuilt with `REACT_APP_TURNSTILE_SITEKEY` in `.env.production.local` |
| change-password route | POST returns 401 without auth (route live) |

## cloud_run.env updates (local, not committed)

- `TURNSTILE_SITEKEY` + `TURNSTILE_SECRET` (Cloudflare raullavita1988 account)
- `CORS_ORIGINS` extended with `www.supersecurechat.com`, `supersecurechat.com`, `super-chat-b0992.web.app`

## TASK P founder actions

| ID | Action | Status |
|----|--------|--------|
| P.1 | Create Cloudflare Turnstile keys | **Done** |
| P.2 | Add TURNSTILE_* to cloud_run.env + REACT_APP_TURNSTILE_SITEKEY, redeploy | **Done** |
| P.3 | Map api.supersecurechat.com (Porkbun CNAME `api` → `ghs.googlehosted.com`) | **Done** — SSL provisioned |
| P.4 | Google OAuth authorized domain + redirect URIs | **Pending** — add `https://api.supersecurechat.com/api/auth/google/callback` |
| P.5 | Optional API URL migration after P.3 | CORS done; `GOOGLE_REDIRECT_URI` still Cloud Run URL |
| P.6 | TURN off-LAN device call proof | **Pending** |
| P.7 | Cloudflare Email Routing hello@ | **Skipped** by founder |
| P.8–P.10 | Code-sign, Play Console, GCP alerts | Deferred |

## Remaining client rebuild

APK + desktop builds still **v1.0.7** without baked Turnstile site key — rebuild after P.2 for native login/register captcha.

See `scripts/TASK_P_FOUNDER_STEPS.txt` for copy-paste steps.