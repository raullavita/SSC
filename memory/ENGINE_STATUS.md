# SSC Engine Status

**Updated:** 2026-06-23  
**Canonical copy:** sync with `Desktop/SSC-MASTER-ROADMAP.md`

## Complete

| Engine | Gate command | Tests (23 Jun) |
|--------|--------------|----------------|
| 1 Retention | `scripts/run_engine1_gate.py` | Included in 303 total |
| 2 E2E integrity | `scripts/run_engine2_gate.py` | Included in 303 total |
| 3 Client footprint | `scripts/run_engine3_gate.py` | 61 unit + 4 integration + proof |

## Next: Engine 4

Metadata minimization — see `RETENTION_CHARTER.md` (last_seen, push payloads, contacts review).

## Open deferred gaps

| ID | Item | Engine |
|----|------|--------|
| C8 | JWT in localStorage | 5 |
| G6 | WebRTC signaling cleartext | 8 |
| G9 | Signal Protocol / Double Ratchet | 8 |

## Panic wipe policy

Wipe chats/files/calls/sessions/device secrets. **Preserve account + contacts.**