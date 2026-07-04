# SSC Engine 13 Charter — Complete (No Inside AI)

**Version:** 1.0  
**Effective:** 2026-07-04

## Scope

Everything needed for a production-grade secure messenger **without** inside AI.

| Step | Deliverable |
|------|-------------|
| 13.1 | Remove Ollama / smart replies |
| 13.2 | Safety numbers (`libsignal` Fingerprint) |
| 13.3 | Encrypted reactions (`signal_v1_reaction`) |
| 13.4 | Message threads (`reply_to`) |
| 13.5 | PQXDH Kyber prekey enforcement (production) |
| 13.6 | `validate_deploy.ps1` (dry-run, no live push) |
| 13.7 | ChatHome reactions + thread UI |
| 13.8 | `NO_INSIDE_AI` in charter + smart config |
| 13.9 | `complete_proof.py` + tests |
| 13.10 | `run_engine13_gate.py` |

## Deploy

Deploy scripts exist from Engine 10. Engine 13 adds **validation only** — no automatic cloud deploy.

## Gate

`backend/scripts/run_engine13_gate.py` must pass step **13.10**.