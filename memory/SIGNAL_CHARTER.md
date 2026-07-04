# SSC Signal Protocol Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 8 — Signal Protocol

## Approved library sources

- `@signalapp/libsignal-client` (npm / Electron)
- `libsignal-android` (Gradle AAR)
- Official Signal zkgroup bindings

## Forbidden

- Community forks, archived libsignal repos, or unaudited crypto libraries.

## Server policy

- Server stores public prekey bundles only.
- Server never stores X3DH session state or ratchet keys.
- Message bodies are `signal_v1` ciphertext blobs.

*Full Engine 8 steps (8.1–8.12) implemented in Phase 3–4.*