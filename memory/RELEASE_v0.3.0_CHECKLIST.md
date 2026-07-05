# Release v0.3.0 — Production deploy checklist

**Tag:** `v0.3.0`  
**Date:** 2026-07-05

## Pre-release verification

| # | Check | Command / URL |
|---|-------|---------------|
| 1 | CI green on `main` | https://github.com/raullavita/SSC/actions |
| 2 | Step 18 proof | `cd backend && python scripts/step18_proof.py` |
| 3 | Platform release proof | `cd backend && python scripts/platform_release_proof.py` |
| 4 | Backend tests | `cd backend && python -m pytest tests/ -q` |
| 5 | Open-source docs on `main` | `LICENSE`, `README.md`, `THIRD_PARTY_NOTICES.md` |
| 6 | Landing page (info only) | https://www.supersecurechat.com — OSS section visible |
| 7 | API health (after deploy) | https://api.supersecurechat.com/api/health — version `0.3.0` |

## Build artifacts (local)

```powershell
# Windows installer
.\scripts\build_electron.ps1
# → electron\dist\SSC-Setup-0.3.0.exe

# Android APK
.\scripts\build_android.ps1
# → android\app\build\outputs\apk\release\SSC-0.3.0.apk
```

## GitHub Release

1. Tag `v0.3.0` on `main`
2. Attach `SSC-Setup-0.3.0.exe` and `SSC-0.3.0.apk`
3. Paste `CHANGELOG.md` section for 0.3.0 as release notes
4. Confirm landing download URLs resolve (`releases/latest/download`)

## Open-source compliance (AGPL / libsignal)

- [ ] `LICENSE` (AGPL-3.0) committed on `main`
- [ ] `THIRD_PARTY_NOTICES.md` lists libsignal 0.96.4 with AGPL notice
- [ ] README links to GitHub source and license
- [ ] Landing page **Open source & compliance** section links to repo + libsignal upstream
- [ ] GitHub repo is public at https://github.com/raullavita/SSC

## Post-release

- [ ] Mark Step 18 complete in `memory/ROADMAP.md`
- [ ] Deploy API + hosting when ready so health reports `0.3.0`