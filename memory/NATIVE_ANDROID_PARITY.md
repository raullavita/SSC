# Native multi-platform status

## Android (Compose) — primary product client

**Build:** `android/0.4.0/15` · compile green

### Done
- Auth: login, register, Google OAuth, recovery, panic wipe, username
- Messaging: list, 1:1 E2EE, multi-device ciphertexts, groups + sender-key distribution, reply, edit, delete, typing, search
- **Sealed sender** toggle + **disappearing default** timers
- Media: files, voice notes
- Social: friends, block, stories compose + feed, polls + encrypted vote API
- Calls:
  - Incoming overlay + answer/decline
  - Outgoing **1:1 mesh WebRTC** audio + **video**
  - ICE / TURN from API, E2EE signaling
  - **Group SFU (mediasoup)** — full WS join, create/connect transports, produce/consume, resume; audio publish + optional camera; mute/cam toggles
  - **SFU room fan-out** (`sfu_room` WS to peers + conversation); `sfu_room_ended` hangup; Answer joins with shared token
  - **Video tiles** — local + remote `SurfaceViewRenderer` in call overlay
- Presence heartbeat
- Devices: list, revoke, link token, deep-link confirm
- Backup: encrypted local export
- **Free sideload distribution** (no Play fee) — `docs/FREE_DISTRIBUTION.md`
- **Offline/online banner** + WS auto-reconnect
- **FCM notification tray** (generic body only)
- **Read ticks** (✓ / ✓✓) + open **file/voice attachments**
- Invite copy/share, typing receive, optimistic send
- **Prekey status + auto-replenish**; group members + leave; thread filter; global privacy
- **Reactions** emoji picker + decrypted aggregates
- **Broadcast lists** fan-out send from Settings

### Remaining polish (no Mac / no paid stores required for most)
- SFU live: redeploy GCE SFU with `existingProducers` harden (see `docs/LIVE_SFU_HARDEN.md`)
- Multi-remote video tiles (currently one remote + local preview)
- Windows Qt libsignal FFI
- iOS when a Mac is available
- Play / App Store only when you choose to pay later

## iOS (SwiftUI)
- Login / list / thread
- **Keychain** for access token
- **libsignal** encrypt/decrypt + prekey upload path
- No WKWebView product path

## Desktop (Qt Quick)
- Login / split chat list + message list + send shell
- Platform client header `windows` / `mac`
- libsignal FFI still next for production E2EE

See `memory/NATIVE_CLIENT_CHARTER.md` and `memory/SFU_CHARTER.md`.
