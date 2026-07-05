# Release v0.2.0 — Production deploy checklist

**Issue:** #20  
**Tag:** `v0.2.0`  
**Date:** 2026-07-05

## Pre-release verification

| # | Check | Command / URL |
|---|-------|---------------|
| 1 | CI green on `main` | https://github.com/raullavita/SSC/actions |
| 2 | Step 8 proof | `cd backend && python scripts/step8_proof.py` |
| 3 | Platform release proof | `cd backend && python scripts/platform_release_proof.py` |
| 4 | Backend tests | `cd backend && python -m pytest tests/ -q` |
| 5 | Open-source docs on `main` | `LICENSE`, `README.md`, `THIRD_PARTY_NOTICES.md` |
| 6 | Landing page (info only) | https://www.supersecurechat.com — OSS section visible |
| 7 | API health | https://api.supersecurechat.com/api/health — version `0.2.0` |

## Build artifacts (local)

```powershell
# Windows installer
.\scripts\build_electron.ps1
# → electron\dist\SSC-Setup-0.2.0.exe

# Android APK
.\scripts\build_android.ps1
# → android\app\build\outputs\apk\release\app-release.apk
# Rename to SSC-0.2.0.apk for GitHub Releases
```

## Deploy surfaces

| Surface | Script | Notes |
|---------|--------|-------|
| Firebase Hosting | `.\scripts\deploy_hosting.ps1` | `REACT_APP_SSC_LANDING_ONLY=true` in `frontend/.env.production` |
| Cloud Run API | `.\scripts\deploy_cloud_run.ps1` | Requires rotated `JWT_SECRET`, `REDIS_URL` |
| TURN (optional) | `.\scripts\deploy_turn_gce.ps1` | For NAT traversal on calls |
| SFU (optional) | `sfu-server/` | `SSC_SFU_ENABLED=true` on API |

## GitHub Release

1. Tag `v0.2.0` on `main`
2. Attach `SSC-Setup-0.2.0.exe` and `SSC-0.2.0.apk`
3. Paste `CHANGELOG.md` section for 0.2.0 as release notes
4. Confirm download URLs on landing page resolve

## Open-source compliance (AGPL / libsignal)

- [ ] `LICENSE` (AGPL-3.0) committed on `main`
- [ ] `THIRD_PARTY_NOTICES.md` lists libsignal 0.96.4 with AGPL notice
- [ ] README links to GitHub source and license
- [ ] Landing page **Open source & compliance** section links to repo + libsignal upstream
- [ ] GitHub repo is public at https://github.com/raullavita/SSC

## Post-release

- [ ] Close GitHub issue #20
- [ ] Mark Step 8 complete in `memory/ROADMAP.md`