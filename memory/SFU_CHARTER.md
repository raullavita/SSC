# SSC Group Call SFU Charter

**Version:** 1.1  
**Effective:** 2026-07-04  
**Engine:** 9 — Group calls + SFU

## Policy

- Mesh WebRTC capped at 8 participants (`MESH_MAX_PARTICIPANTS`).
- Larger groups use optional SFU (**mediasoup** OSS) when `SSC_SFU_ENABLED=true`.
- Signaling payloads are ratchet-encrypted (`signal_v1` / `signal_v1_sealed`).
- SFU room tokens are short-lived; server never decrypts media.

## API

- `GET /api/sfu/config` — SFU availability + mediasoup ws URL
- `POST /api/sfu/rooms` — create room for group conversation
- `POST /api/calls` with `group_call=true` — auto-selects mesh vs SFU

## Gate

Implemented in Engine 9 step **9.7–9.8**; verified by `advanced_proof.py`.