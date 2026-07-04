# SSC Signal Protocol Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 8 — Signal Protocol + Comms Stack

## Approved library sources

- `@signalapp/libsignal-client` (npm / Electron) — **v0.96.4**
- `libsignal-android` (Gradle AAR)
- Official Signal zkgroup bindings
- **LibreTranslate** (OSS translation proxy)
- **WebRTC** (browser RTCPeerConnection + STUN)

## Forbidden

- Community forks, archived libsignal repos, or unaudited crypto libraries.
- Server-side decryption of message, file, or signaling payloads.

## Server policy

- Server stores **public prekey bundles only** — never private keys or ratchet state.
- Message bodies are `signal_v1` ciphertext blobs (dev envelope allowed in development only; production rejects placeholder/dev protocols).
- File attachments are `signal_v1` encrypted blobs with malware magic-byte blocking.
- WebRTC signaling relay carries ratchet-encrypted envelopes (`signal_v1`).
- LibreTranslate proxy translates client-supplied text; server does not log content.

## Modules

| Module | Purpose |
|--------|---------|
| `backend/core/signal_policy.py` | Protocol validation, prekey scrubbing |
| `backend/core/abuse_policy.py` | Rate limits, spam heuristics, file magic-byte block |
| `backend/core/file_policy.py` | Encrypted file relay DTOs |
| `backend/core/call_policy.py` | WebRTC call session policy |
| `backend/core/translation_policy.py` | LibreTranslate OSS config |
| `backend/routers/prekeys.py` | Public prekey bundle upload/fetch |
| `backend/routers/devices.py` | Multi-device registry |
| `backend/routers/files.py` | Encrypted file upload/download |
| `backend/routers/calls.py` | Call setup + encrypted signaling relay |
| `backend/routers/translation.py` | Translation proxy |
| `backend/routers/abuse.py` | Abuse reports |
| `frontend/src/signal/signalBridge.js` | libsignal-client bridge |
| `electron/preload.js` | Electron crypto injection |

## Implementation steps

| Step | Deliverable |
|------|-------------|
| 8.1 | `signal_policy.py` + `signal_v1` protocol |
| 8.2 | Prekey bundle API |
| 8.3 | Device registry API |
| 8.4 | Message relay accepts `signal_v1` |
| 8.5 | Encrypted file transfer API |
| 8.6 | WebRTC call signaling relay |
| 8.7 | Abuse rate limits + malware file block |
| 8.8 | LibreTranslate OSS proxy |
| 8.9 | Frontend `@signalapp/libsignal-client` bridge |
| 8.10 | Frontend files, calls, translation UI |
| 8.11 | `signal_proof.py` + unit tests |
| 8.12 | `run_engine8_gate.py` pass |

## Gate

Engine 8 completes when `backend/scripts/run_engine8_gate.py` passes, including **step 8.12** `signal_proof.py`.

*Machine-readable: `SSC/backend/core/engine8.py`*