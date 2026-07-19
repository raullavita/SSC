# Electron shell — Windows shipping path (see WINDOWS_CLIENT.md)

**Update 2026-07-19:** Electron is **not** the long-term UI architecture, but it **is** the **Windows shipping messenger** until Qt + libsignal FFI is complete.

| Role | Path |
|------|------|
| **Android product** | `android/` Compose + libsignal-android |
| **Windows product (now)** | `electron/` + frontend + libsignal-client 0.96.4 → `SSC-Setup-0.4.0.exe` |
| **Windows future** | `desktop/` Qt Quick (scaffold; no E2EE yet) |

Full build and A↔W test notes: **[WINDOWS_CLIENT.md](WINDOWS_CLIENT.md)**.

## Still retired / forbidden

- WebView **Android** messenger (`assets/www`) — Compose only
- SAC_COMPAT Electron builds (no libsignal) for production messaging
- Treating Qt `desktop/` as ready for Android interop tests

## Version

Align with `backend/core/release_policy.py`: **0.4.0 / build 15**.  
Client header from preload: `windows/0.4.0/15`.
