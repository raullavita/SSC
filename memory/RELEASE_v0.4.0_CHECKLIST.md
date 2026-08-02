# Release v0.4.0 - Native product baseline checklist

**Tag:** v0.4.0  
**Date:** 2026-07-19  
**Status:** Shipped

## Verification summary

- [x] Changelog includes v0.4.0 native rebuild notes
- [x] Backend release version is 0.4.0
- [x] Android app versionName is 0.4.0
- [x] Windows Qt artifact built at dist/windows-qt/SSC-Desktop-0.4.0.exe
- [x] Android artifact path standardized to android/app/build/outputs/apk/release/SSC-0.4.0.apk
- [x] Desktop install/launch smoke verified via scripts/install_ssc_desktop.ps1

## Local validation commands

```powershell
# Backend
cd backend
python -m pytest tests/ -q

# Frontend
cd ..\frontend
yarn test:ci

# Android (native Compose)
cd ..
.\scripts\build_android.ps1

# Windows (Qt)
.\scripts\build_desktop_windows.ps1

# Optional production probe
.\scripts\release_smoke_test.ps1
```

## Artifacts

- Windows Qt: dist/windows-qt/SSC-Desktop-0.4.0.exe
- Android: android/app/build/outputs/apk/release/SSC-0.4.0.apk

## Notes

- Electron/WebView path is retained only as legacy tooling references and is not the primary Windows product UI.
- See docs/ELECTRON_RETIRED.md and docs/WINDOWS_CLIENT.md for current product direction.
