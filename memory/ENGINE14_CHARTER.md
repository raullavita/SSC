# SSC Engine 14 — Production Push + SFU Live

**Version:** 1.0  
**Effective:** 2026-07-04

## Scope

Close the production gap between deploy scaffolds and live user-facing push + SFU:

| Step | Deliverable |
|------|-------------|
| 14.1 | `backend/core/engine14.py` completion registry |
| 14.2 | FCM generic push wired on message send |
| 14.3 | SFU `wss://` URL in production health |
| 14.4 | `production_push_proof.py` |
| 14.5 | `run_engine14_gate.py` |
| 14.6 | This charter |

## Gate

Engine 14 completes when `backend/scripts/run_engine14_gate.py` passes step **14.5**.