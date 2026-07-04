# SSC Messaging Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 3 — Core Messaging Scaffold

## Scope (pre-crypto)

- Email/password register + login (installed clients only)
- 1:1 conversations
- Message relay with **placeholder** ciphertext (`protocol: placeholder`)
- WebSocket fanout on `conversation:{id}` topics

## Auth (Engine 3)

- Bearer JWT returned on login/register (httpOnly cookies in Engine 5)
- `GET /api/auth/me` requires bearer token

## Realtime

- `WS /api/ws?token=<jwt>`
- Client sends `{"type":"subscribe","topic":"conversation:<id>"}`
- Server pushes `{"type":"message","message":{...}}`

## Gate

Engine 3 completes when `backend/scripts/run_engine3_gate.py` passes (**step 3.7**).