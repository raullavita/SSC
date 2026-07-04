# SSC Security

## Phase 0

Security charters live in `memory/`. Engine gates enforce implementation order.

## Data lifecycle (Engine 1)

- **24h TTL:** Ephemeral relay data (`messages`, `files`, `call_sessions`, `stories`, etc.) carries an `expires_at` field. MongoDB TTL indexes purge rows automatically.
- **Session TTL:** `sessions` and `refresh_tokens` expire via `expires_at` (refined in Engine 5).
- **Panic wipe:** `POST /api/panic/wipe` immediately deletes all user data across every collection in the retention charter. Stronger than TTL — nothing survives.

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