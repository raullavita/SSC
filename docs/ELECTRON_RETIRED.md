# Electron — not the Windows product UI

**Windows product path is Qt** (`desktop/` + crypto-worker). See [WINDOWS_CLIENT.md](WINDOWS_CLIENT.md).

| Path | Role |
|------|------|
| **Android** | Jetpack Compose + libsignal-android |
| **Windows** | Qt Quick + libsignal-client worker |
| **`electron/`** | Legacy sources / optional historical installers — **not** the look-and-feel product for Windows |

Do not ship Electron as the end-user Windows messenger when the Qt build is available.

Android WebView messenger remains retired (Compose only).
