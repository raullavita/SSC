# SSC Security Hardening Roadmap

Last updated: 2026-07-06  
Scope: Super Secure Chat (install-only E2E chat) — backend, clients, ops.

This document is the master plan from the red-team audit. Work proceeds phase by phase; each phase must pass verification before the next begins.

---

## Current posture

| Strength | Gap |
|----------|-----|
| Signal-protocol E2E design | Dev crypto fallbacks still in bundles |
| Ciphertext-only server relay | JWT/OAuth/rate-limit weaknesses |
| httpOnly session cookies | Keys on disk unencrypted (Phase 2) |
| Install-only client charter | No certificate pinning (Phase 2) |
| Panic wipe + retention charters | iOS crypto stub (Phase 3) |
| Phase 2 encrypted stores + pinning | — |

---

## Open gates (full inventory)

### Critical

| ID | Gate | Location |
|----|------|----------|
| C1 | JWT secret dev default | `backend/config.py` |
| C2 | OAuth missing `state` validation | `backend/routers/auth.py` |
| C3 | In-memory rate limits (multi-instance bypass) | `backend/core/abuse_policy.py` |
| C4 | Dev crypto fallbacks in prod bundle | `frontend/src/signal/*` |
| C5 | Installed-client gate bypass (`window.__SSC_*`) | `InstalledClientGate.jsx` |
| C6 | Signal keys on disk plaintext | Android/Electron stores |
| C7 | Android WebView permissive settings | `MainActivity.kt` |
| C8 | iOS crypto stub | `SscNativeBridge.swift` |
| C9 | No certificate pinning | All clients |
| C10 | WS token in URL query string | `api.js`, `routers/ws.py` |

### High

| ID | Gate |
|----|------|
| H1 | SFU internal secret dev default |
| H2 | CORS too permissive with credentials |
| H3 | Recovery passphrase fast SHA256 |
| H4 | OAuth/recovery codes in memory dicts |
| H5 | Production checks not enforced at startup |
| H6 | No CSP / HSTS |
| H7 | Installed-client optional + broad exemptions |
| H8 | Prekey fetch without relationship check |
| H9 | Translation proxy plaintext |

### Medium / Low

See GitHub issues #54–#75 and security issues opened from this audit.

---

## Phase 1 — Close the barn doors (target: 1–2 weeks)

| # | Task | Closes | Status |
|---|------|--------|--------|
| 1.1 | Fail hard on weak/missing secrets in production startup | C1, H1, H5 | **Done** |
| 1.2 | OAuth `state` store + validate on callback | C2 | **Done** |
| 1.3 | Redis-backed rate limits (memory fallback in dev/test) | C3 | **Done** |
| 1.4 | Enforce `production_env_valid()` in app lifespan | H5 | **Done** |
| 1.5 | Mandatory `REACT_APP_SSC_REQUIRE_LIBCRYPTO=true` in release builds + CI check | C4, C5 | **Done** |
| 1.6 | HSTS + tighten CORS (no `*` with credentials) | H2, H6 | **Done** |
| 1.7 | WS auth via cookie + first-message token (no URL query in prod) | C10 | **Done** |

**Phase 1 exit criteria** (verified 2026-07-06)

- [x] Production cannot start with default JWT/SFU secrets (`core/startup_gates.py`)
- [x] OAuth CSRF blocked via `state` (`core/oauth_state.py`)
- [x] Rate limits use Redis when `REDIS_URL` set; prod requires Redis (`core/rate_limit.py`)
- [x] Release build scripts enforce libsignal requirement (`scripts/verify_phase1_build_policy.ps1`)
- [x] HSTS on production responses; CORS rejects `*`
- [x] WS URL never contains `?token=`; server rejects query token in prod
- [x] `pytest tests/ -q` — 218 passed
- [x] `yarn test:ci` — 97 passed
- [x] `ruff check` clean

---

## Phase 2 — Raise the walls (2–6 weeks)

| # | Task | Closes | Status |
|---|------|--------|--------|
| 2.1 | Encrypt signal stores at rest (Keystore / safeStorage / Keychain) | C6 | **Done** |
| 2.2 | Certificate pinning on API + WSS | C9 | **Done** |
| 2.3 | Harden Android WebView (remove file URL access, restrict bridge) | C7 | **Done** |
| 2.4 | Native bridge attestation (not `window.__SSC_*` alone) | C5, H7 | **Done** |
| 2.5 | Argon2id for recovery passphrases | H3 | **Done** |
| 2.6 | Redis for OAuth one-time codes + recovery tokens | H4 | **Done** |
| 2.7 | Content-Security-Policy on API + WebView shells | H6 | **Done** |
| 2.8 | Prekey fetch authz or strict rate limits | H8 | **Done** |
| 2.9 | Minimum client build version on API | — | **Done** |

**Phase 2 exit criteria** (verified 2026-07-06)

- [x] Android `SscSecureStore` (Keystore AES-GCM) + Electron `safeStorage` for signal JSON stores
- [x] Android `network_security_config.xml` + Electron `setCertificateVerifyProc` pinning
- [x] `X-SSC-Native-Bridge: v1` required in production (`installed_client_policy.py`)
- [x] Recovery passphrases use Argon2id with legacy SHA256 migration (`recovery_crypto.py`)
- [x] OAuth codes + recovery tokens in Redis via `short_lived_tokens.py`
- [x] CSP on API responses; prekey fetch rate limits; min client build 8
- [x] `scripts/verify_phase2_build_policy.ps1`
- [x] `pytest tests/test_phase2_security.py -q`
- [x] `yarn test:ci`

---

## Phase 3 — Fortress mode (ongoing)

| # | Task | Closes |
|---|------|--------|
| 3.1 | iOS libsignal-swift native bridge | C8 |
| 3.2 | Play Integrity / DeviceCheck attestation | C5 |
| 3.3 | Short-lived WS subscribe tokens | C10 |
| 3.4 | Argon2id passwords + pepper rotation | — |
| 3.5 | ZAP/Semgrep fail CI on high findings | — |
| 3.6 | CAPTCHA on public feedback + recovery | — |
| 3.7 | SFU mTLS or stronger internal auth | H1 |
| 3.8 | Threat-model tests in engine gates | — |

---

## Defense layers (target end state)

```
Layer 1  Transport      TLS + cert pinning + WSS only
Layer 2  Auth           OAuth state, strong JWT, Redis sessions
Layer 3  API            Redis rate limits, installed-client enforcement
Layer 4  Crypto         Signal only in prod — no dev fallbacks in release
Layer 5  Device         Encrypted key stores, panic wipe
Layer 6  Process        Protected main, audits, dependency updates
Layer 7  Human          Safety numbers, recovery keys
```

---

## Verification commands

```powershell
# Backend
cd backend
.\venv\Scripts\python.exe -m pytest tests/ -q
.\venv\Scripts\python.exe -m ruff check .

# Frontend
cd frontend
yarn test:ci

# Full audit (local)
.\scripts\full_app_audit.ps1 -SkipSmoke

# Phase 1 security tests
cd backend
.\venv\Scripts\python.exe -m pytest tests/test_phase1_security.py -q

# Phase 2 security tests + build policy
.\venv\Scripts\python.exe -m pytest tests/test_phase2_security.py -q
cd ..
.\scripts\verify_phase2_build_policy.ps1
```

---

## References

- `SECURITY.md` — vulnerability reporting
- `memory/SESSION_HARDENING_CHARTER.md`
- `memory/SIGNAL_CHARTER.md`
- `memory/METADATA_MINIMIZATION_CHARTER.md`
- `audit-reports/SSC-FULL-AUDIT-*.md`