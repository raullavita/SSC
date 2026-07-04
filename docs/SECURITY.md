# SSC Security

## Phase 0

Security charters live in `memory/`. Engine gates enforce implementation order.

## Data lifecycle (Engine 1 — forthcoming)

- **24h TTL:** Ephemeral relay data (messages) expires automatically.
- **Panic wipe:** User-triggered immediate deletion across all collections.

See `memory/RETENTION_CHARTER.md` for the full collection registry.