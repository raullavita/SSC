# SSC Group Call SFU Charter

**Version:** 1.2  
**Effective:** 2026-07-04  
**Engine:** 9 + 11 — Group calls + SFU full wiring

## Policy

- Mesh WebRTC capped at 8 participants (`MESH_MAX_PARTICIPANTS`).
- Larger groups use optional SFU (**mediasoup** OSS) when `SSC_SFU_ENABLED=true`.
- Signaling payloads are ratchet-encrypted (`signal_v1` / `signal_v1_sealed`).
- SFU room tokens are short-lived; server never decrypts media.

## API

- `GET /api/sfu/config` — SFU availability + mediasoup ws URL
- `GET /api/calls/ice-servers` — STUN + ephemeral TURN credentials (Step 3)
- `POST /api/sfu/rooms` — create room for group conversation
- `POST /api/calls` with `group_call=true` — auto-selects mesh vs SFU

## TURN / NAT (Step 3)

- **coturn** on the SFU GCE host (`turn/` + `scripts/deploy_turn_gce.ps1`)
- API issues time-limited credentials via `SSC_TURN_SECRET` (coturn `use-auth-secret`)
- Clients: `useCall` (mesh) and `sfuSession` (mediasoup transports) fetch `iceServers` from API

## Engine 11 wiring

- SFU server: WebSocket join, WebRTC transport, produce/consume
- Backend: `sfu_client.provision_sfu_room()` on `POST /api/sfu/rooms`
- Frontend: `sfuSession.js` + `connectSfuRoom()` in group calls

## Gate

Engine 9 scaffold: `advanced_proof.py`.  
Engine 11 full wiring: `sfu_wiring_proof.py` + `run_engine11_gate.py` step **11.12**.