# SSC Installed Client Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 2 — Installed Client Enforcement

## Rule

SSC API access requires an **installed client** (Android APK, iOS app, Windows/Mac Electron). Browser-tab usage is blocked.

## Header

| Header | Format | Example |
|--------|--------|---------|
| `X-SSC-Client` | `platform/semver[/build]` | `android/0.1.0/42` |

### Allowed platforms

`android`, `ios`, `windows`, `mac`, `electron`

## Exempt routes

- `GET /api/health` — uptime monitors only

All other `/api/*` routes return **403** without a valid header.

## Client implementation

- `frontend/src/lib/installedClient.js` — builds header from build-time env vars
- `frontend/src/lib/api.js` — attaches header on every API request
- `REACT_APP_SSC_REQUIRE_LIBCRYPTO=true` — production builds hard-require `window.sscCrypto` (Step 4)

## Gate

Engine 2 completes when `backend/scripts/run_engine2_gate.py` passes (step 2.7).