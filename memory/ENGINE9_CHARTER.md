# SSC Engine 9 Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 9 — Multi-Device, Sealed Sender, Groups, SFU

## Scope

Backend + frontend **scaffolds only** — no APK/Electron installer packaging in this engine.

## Features

### 9.1–9.2 Multi-device
- Up to 5 linked devices per user (`SSC_MAX_DEVICES_PER_USER`)
- QR/link token flow: `POST /api/devices/link` → `POST /api/devices/link/confirm`
- Tokens expire in 10 minutes (Mongo TTL on `device_link_tokens`)

### 9.3–9.4 Sealed sender
- Protocol: `signal_v1_sealed`
- Server stores `sender_id` for panic wipe but **strips it from API/WS** for recipients
- Sender still sees their own `sender_id`

### 9.5 Group chat
- `POST /api/groups` creates group + linked `type=group` conversation
- Metadata-minimized: `group_id` + `member_count`, no participant emails

### 9.6 Multi-device sync
- Messages fan out to `conversation:{id}` **and** `user:{id}` for all participants

### 9.7–9.8 Group calls + SFU
- Mesh WebRTC capped at 8 (`MESH_MAX_PARTICIPANTS`)
- Larger groups: optional **mediasoup** SFU (`SSC_SFU_ENABLED=true`)
- `GET /api/sfu/config`, `POST /api/sfu/rooms`

### 9.9 Frontend hooks
- `useMultiDevice`, `sealedSender.js`, `useGroupChat`, `useGroupCall`, `sfuClient.js`

### 9.10 Security CI
- OWASP ZAP baseline scan skeleton in `.github/workflows/ci.yml`

## OSS dependencies

| Component | Source |
|-----------|--------|
| Sealed sender | Signal protocol (client-side libsignal) |
| SFU | [mediasoup](https://github.com/versatica/mediasoup) |
| ZAP scan | [OWASP ZAP](https://www.zaproxy.org/) |

## Gate

Engine 9 completes when `backend/scripts/run_engine9_gate.py` passes, including **step 9.12** `advanced_proof.py`.

*Machine-readable: `SSC/backend/core/engine9.py`*