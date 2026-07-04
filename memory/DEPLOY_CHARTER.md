# SSC Production Deploy Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 10 — Production Deploy + Platform Scaffolds

## Targets

| Surface | Host | Platform |
|---------|------|----------|
| Web shell | `www.supersecurechat.com` | Firebase Hosting |
| API | `api.supersecurechat.com` | Cloud Run |
| SFU (optional) | `sfu.supersecurechat.com` | mediasoup Node server |
| Android | Play Store (future) | Gradle + libsignal-android |

## Production requirements

- `SSC_ENV=production`
- `REDIS_URL` required (session validation gate)
- `JWT_SECRET` rotated (not dev default)
- `SSC_ENFORCE_INSTALLED_CLIENT=true`
- CORS limited to production web origins

## Deliverables (no app packaging in Engine 10)

| Step | Artifact |
|------|----------|
| 10.1 | `deploy_policy.py` |
| 10.2 | `backend/Dockerfile` |
| 10.3 | `firebase.json` + `.firebaserc` |
| 10.4 | `scripts/deploy_cloud_run.ps1`, `deploy_hosting.ps1` |
| 10.5 | `sfu-server/` mediasoup scaffold |
| 10.6 | `android/` Gradle scaffold |
| 10.7 | Production `check_ready.py` + CORS defaults |
| 10.8 | `.env.production.example` files |
| 10.9 | `.github/workflows/deploy.yml` |
| 10.10 | `deploy_proof.py` + tests |
| 10.11 | This charter |
| 10.12 | `run_engine10_gate.py` |

## Deploy commands

```powershell
# Validate production env
cd backend
$env:SSC_ENV="production"
python check_ready.py

# Cloud Run (requires gcloud + docker)
.\scripts\deploy_cloud_run.ps1

# Firebase Hosting (requires firebase CLI)
.\scripts\deploy_hosting.ps1
```

## Gate

Engine 10 completes when `backend/scripts/run_engine10_gate.py` passes, including **step 10.12** `deploy_proof.py`.