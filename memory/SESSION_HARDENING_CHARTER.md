# SSC Session Hardening Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 5 — Session Hardening

## Principles

1. **No JWT in `localStorage`** — web sessions use httpOnly `ssc_session` cookies only.
2. **Centralized TTL** via `backend/core/session_ttl.py` (JWT `exp` and Mongo `expires_at`).
3. **Production requires Redis** for session validation and revocation (`validate_production_redis`).
4. **Panic wipe revokes all sessions** before deleting user data.
5. **Google Sign-In** runs only inside installed clients (APK / Electron) — not in the web shell.

## Modules

| Module | Purpose |
|--------|---------|
| `backend/core/session_ttl.py` | Single source of truth for session lifetime |
| `backend/core/session_policy.py` | Cookie name, collection name, bearer fallback flag |
| `backend/core/session_cookie.py` | Set/clear/read httpOnly cookie |
| `backend/core/session_issue.py` | Issue session on login/register |
| `backend/core/token_revocation.py` | Mongo session registry + Redis cache/revocation |
| `backend/core/session_production.py` | Production Redis startup gate |
| `frontend/src/lib/localStorageFootprint.js` | Audit forbidden auth material in localStorage |
| `frontend/src/lib/clientFootprintOrchestrator.js` | Client footprint audit entry point |

## API surfaces

- `POST /api/auth/register` — sets `ssc_session` cookie; **no token in JSON body**
- `POST /api/auth/login` — sets `ssc_session` cookie; **no token in JSON body**
- `POST /api/auth/logout` — revokes current session server-side and clears cookie
- `GET /api/auth/me` — reads session from cookie (bearer fallback for native WS bootstrap)
- `GET /api/ws` — accepts session cookie or `?token=` for native clients
- `POST /api/panic/wipe` — requires session auth; revokes all user sessions first

## Implementation steps

| Step | Deliverable |
|------|-------------|
| 5.1 | `session_ttl.py` centralizes JWT + Mongo TTL |
| 5.2 | httpOnly `ssc_session` cookie on auth routes |
| 5.3 | Mongo `sessions` collection + revocation |
| 5.4 | Redis session cache; required in production |
| 5.5 | Remove localStorage JWT from web client |
| 5.6 | Panic wipe revokes all sessions |
| 5.7 | `session_proof.py` + `run_engine5_gate.py` pass |

## Gate

Engine 5 completes when `backend/scripts/run_engine5_gate.py` passes, including **step 5.7** `session_proof.py`.

*Machine-readable: `SSC/backend/core/session_policy.py`, `SSC/backend/core/engine5.py`*