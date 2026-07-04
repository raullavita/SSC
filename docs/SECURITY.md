# SSC Security

## Phase 0

Security charters live in `memory/`. Engine gates enforce implementation order.

## Data lifecycle (Engine 1)

- **24h TTL:** Ephemeral relay data (`messages`, `files`, `call_sessions`, `stories`, etc.) carries an `expires_at` field. MongoDB TTL indexes purge rows automatically.
- **Session TTL:** `sessions` and `refresh_tokens` expire via `expires_at` (refined in Engine 5).
- **Panic wipe:** `POST /api/panic/wipe` deletes user-scoped account data and detaches the user from shared chats without erasing other participants' messages. Client wipe clears local crypto on the device.

See `memory/RETENTION_CHARTER.md` for the full collection registry.

## Metadata minimization (Engine 4)

- Push payloads are generic only (`SSC` / `New message`).
- Last-seen defaults to hidden; users opt in via privacy settings.
- Conversation APIs omit peer email and participant lists.

See `memory/METADATA_MINIMIZATION_CHARTER.md`.

## Signal Protocol (Engine 8)

- E2EE via `@signalapp/libsignal-client` in installed clients (Electron/Android).
- Server stores public prekey bundles only; relays `signal_v1` ciphertext.
- Encrypted file transfer, WebRTC call signaling, LibreTranslate proxy, abuse rate limits.

See `memory/SIGNAL_CHARTER.md`.

## Advanced messaging (Engine 9)

- **Multi-device:** link tokens (`/api/devices/link`), up to 5 devices per user.
- **Sealed sender:** `signal_v1_sealed` — server strips sender from recipient views.
- **Group chat:** `/api/groups` with metadata-minimized responses.
- **Group calls:** mesh ≤8 participants; mediasoup SFU for larger groups.
- **CI:** OWASP ZAP baseline scan skeleton.

See `memory/ENGINE9_CHARTER.md`.

## Production deploy (Engine 10)

- API on Cloud Run (`backend/Dockerfile`), web on Firebase Hosting (`firebase.json`).
- Production requires Redis, rotated `JWT_SECRET`, installed-client enforcement.
- mediasoup SFU scaffold (`sfu-server/`), Android Gradle scaffold (`android/`).

See `memory/DEPLOY_CHARTER.md`.