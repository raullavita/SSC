# SSC Session Hardening Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 5 — Session Hardening

## Principles

1. No JWT in `localStorage` — sessions use httpOnly secure cookies.
2. Centralized TTL via `backend/core/session_ttl.py`.
3. Production requires Redis for session validation and revocation.
4. Panic wipe revokes all sessions immediately.
5. Google Sign-In runs only inside installed clients (APK / Electron).

*Implementation begins in Engine 5 (Phase 2).*