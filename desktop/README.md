# SSC Desktop — Qt Quick (native Windows)

**Architecture:** True native desktop UI (Qt 6 Quick / QML). **No Electron UI.**

Matches Android Compose dark theme and product flows: login/register/recovery/OAuth,
chats (E2EE, reply, delete, reactions, typing, pin/mute), groups, friends, devices,
privacy, stories, polls, cloud backup, broadcast, realtime WS, call signaling.

| Layer | Tech |
|-------|------|
| UI | Qt 6 Quick + Material + `Theme.qml` (Android palette) |
| Network | `SscApiClient` → `https://api.supersecurechat.com` |
| Session | Memory token + QSettings for non-secrets (`SscSession`) |
| Crypto | `crypto-worker` + `@signalapp/libsignal-client` **0.96.4** |
| Client header | `windows/0.4.0/15` |

## Build (Windows)

```powershell
.\scripts\build_desktop_windows.ps1
```

See [docs/WINDOWS_CLIENT.md](../docs/WINDOWS_CLIENT.md) for Qt install via aqt.

## Layout

```
desktop/
  qml/           # Main, Login, ChatList, Settings, Theme
  src/           # C++ session, API, crypto bridge
  crypto-worker/ # Node libsignal JSON-RPC worker
```

## Not Electron

Electron is retired as the Windows product shell. Do not confuse historical `SSC-Setup-*.exe` with this Qt client.
