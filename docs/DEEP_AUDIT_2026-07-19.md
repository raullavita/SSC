# SSC Deep Audit Report

**Date:** 2026-07-19  
**Commit base:** `8f01abc` (+ local recovery path fix)  
**Scope:** Full tree — Android Compose, backend, SFU/TURN, frontend, iOS, desktop, Electron leftovers  

---

## Executive summary

| Area | Result |
|------|--------|
| **CI (main)** | Green after CI fix commit |
| **Backend unit tests** | **280 passed** |
| **Frontend Jest** | **199 passed** (61 suites) |
| **knip / eslint / ruff** | Pass |
| **Secrets validation** | Pass |
| **Phase 1–3 build policy** | Pass |
| **Android `assembleDebug`** | **BUILD SUCCESSFUL** |
| **semgrep (backend+sfu)** | 1 finding (Dockerfile root user) |
| **pip-audit** | Tool broken in embed Python (`venv` module missing) |
| **Live message A↔B** | **Blocked** — production requires Turnstile captcha; Android UI has **no captcha** |

**Bottom line:** Rebuild tooling and automated tests look solid. Production **account create from native Android is blocked** without captcha. Recovery URLs were wrong (fixed locally). SFU media consume path is best-effort and multi-remote incomplete. iOS/desktop/Electron are scaffolds or retired leftovers.

---

## Tools used

| Tool | Status |
|------|--------|
| ruff | Installed — clean |
| pytest | Installed — 280 passed |
| yarn knip / eslint / jest | Installed — pass |
| semgrep | Installed — 1 Dockerfile finding |
| validate_secrets + phase1–3 scripts | Pass |
| Gradle assembleDebug | Pass |
| Live curl/API smoke | Health OK; auth needs captcha |
| Explore agent (code wiring) | Full pass over Android/backend/ios/desktop |
| pip-audit | Failed to run (embed Python missing `venv`) |
| docker | Not installed on this machine |

---

## CRITICAL (blocks real-world use)

### C1. Production register/login path needs captcha; Android has no Turnstile UI
- **API** (`GET /api/config` with native headers): `"captcha_required": true`, Turnstile site key present  
- **Live test:** `POST /api/auth/register` → `400 captcha_required`  
- **Android** `LoginScreen.kt`: no captcha widget; `AuthRepository.register(..., captchaToken)` never given a token from UI  
- **Impact:** New users **cannot create accounts** on production with the Compose app (email/password). Google OAuth may still work if exempt  
- **Fix:** Integrate Cloudflare Turnstile (WebView or SDK) on register (and recovery verify)

### C2. Recovery API paths were wrong (fixed in tree)
- Was: `/api/recovery/*`  
- Backend: `/api/auth/recovery/*`  
- Fixed in `AuthRepository.kt` this audit  
- **Must commit & ship** or recovery remains dead

### C3. SFU remote consume uses fake ICE/DTLS SDP
- `SfuMediaEngine.buildRecvOfferSdp` hardcodes dummy ice-ufrag/fingerprint  
- Join/produce may work; **reliable multi-party audio/video receive is not production-grade** without mediasoup-client Device or real transport params on consume  
- Multi-remote tracks not modeled (single remote audio/video)

### C4. Live A↔B ciphertext messaging cannot be proven from this host without captcha
- Cannot complete “create two accounts, send encrypted message and back” against production without a Turnstile token  
- CI backend tests **do** cover register + message crypto paths in fake env (280 tests)

---

## HIGH

### H1. Decrypted messages cached as plaintext SQLite
- `LocalMessageDb` stores `plaintext` column  
- Tokens use EncryptedSharedPreferences; **chat bodies do not**  
- Risk: rooted device / filesystem backup

### H2. Device attestation is shared-secret HMAC, not Play Integrity
- `SscDeviceAttest` explicitly stub; empty secret → no header  
- Not hardware-backed

### H3. Desktop Qt: plaintext token + base64 “ciphertext”
- `SscSession.cpp` QSettings token  
- `SscApiClient.cpp` base64 plaintext labeled signal_v1 — not E2EE  
- Scaffold only

### H4. iOS dual `@main` + legacy WebView still present
- `SscApp.swift` and `AppDelegate.swift` both `@main`  
- `MainViewController` WKWebView shell still in tree  
- No Xcode project in repo — cannot build as-is on CI

### H5. Electron still in repo / release artifacts while product path is Compose
- `electron/`, `latest-builds` 0.3.1 EXE  
- Scripts/policy still mention electron  
- Confusion for “what to install”

### H6. Production API still reports `release_version` **0.3.1** / build **14**
- Android client is **0.4.0/15**  
- Config: `"min_client_version":"0.3.1","min_client_build":14` — still allows new client  
- API code version not redeployed with 0.4.0 bump

### H7. Dead WebView stack still in Android package
- `assets/www`, `SscApiBridge`, `SscNativeBridge`, `activity_main.xml` WebView  
- Increases APK size and attack surface; not used by Compose `MainActivity`

---

## MEDIUM

### M1. Groups admin incomplete on Android
- Has create / list members / leave  
- Missing: add/remove members, dissolve group (backend exists)

### M2. Backend features without Android client
| Feature | Backend | Android |
|---------|---------|---------|
| Cloud backup | yes | local only |
| Sesame / multi-device retry | yes | not wired |
| Story delete | yes | no |
| Broadcast list patch | yes | create/list/delete/send only |
| Server translation | yes | ML Kit only |
| Group member add/remove | yes | no |

### M3. Silent empty `catch` (19+ Android files)
- Failures become empty lists / zero sends / silent push skip  
- Hard to debug “it just doesn’t work”

### M4. SFU WSS hostname is temporary sslip.io
- Production API: `wss://35-195-79-31.sslip.io`  
- Some ISPs rewrite `*.sslip.io` (SafeSurf)  
- Porkbun A for `sfu` → static IP still recommended  

### M5. No refresh token
- 401 → forced re-login  

### M6. Recovery/register captcha note without UI  
- Even after path fix, recovery verify may fail in prod without captcha

### M7. Release signing falls back to debug keystore
- Easy to ship “release” APK with debug identity  

### M8. Dockerfile SFU runs as root
- semgrep blocking finding — `sfu-server/Dockerfile` missing non-root USER  

---

## LOW

- Desktop/iOS explicitly incomplete (documented scaffolds)  
- Version skew across electron/sfu-server package.json (0.3.1)  
- `X-HTTP-Method-Override` on non-GET bodies  
- pip-audit not runnable in embed Python  

---

## What works (verified this scan)

| Check | Evidence |
|-------|----------|
| Backend test suite | 280 passed |
| Frontend unit tests | 199 passed |
| Static lint | ruff, eslint, knip clean |
| Android rebuild | assembleDebug SUCCESS |
| API health | mongo/redis/push/sfu enabled |
| SFU HTTP health | `http://35.195.79.31:4443/health` ok |
| Native bridge gate | `X-SSC-Native-Bridge: v1` accepted |
| Captcha gate | Enforced (`captcha_required`) |
| CI | Green on main (`8f01abc`) |

---

## Live production probe notes

```
GET  /api/health          → 200, sfu.enabled=true
GET  /api/config          → needs X-SSC-Client + X-SSC-Native-Bridge: v1
POST /api/auth/register   → 400 captcha_required (with proper headers)
```

**Cannot prove encrypted message round-trip on production from automation** without Turnstile tokens. CI suite covers the crypto/message stack offline.

---

## Rebuild confidence

| Artifact | Rebuild? |
|----------|----------|
| Backend tests | Yes — green |
| Frontend tests + landing | Yes — green |
| Android debug APK | Yes — green |
| Android release APK | Needs keystore + captcha UX for prod signup |
| Full E2E on phones | Blocked until captcha on Android **or** captcha disabled for test |

---

## Recommended fix order

1. **Wire Turnstile on Android register/login** (C1) — otherwise production signup fails  
2. **Ship recovery URL fix** (C2) — done in working tree  
3. **Redeploy API** so `release_version` is 0.4.0/15 (H6)  
4. **SFU consume SDP** real ICE/DTLS (C3) or document “SFU experimental”  
5. **Strip WebView assets/bridges** from Android product build (H7)  
6. **Encrypt local message cache** or clear plaintext option (H1)  
7. **Porkbun A records** `sfu`/`turn` → `35.195.79.31`  
8. Align or archive Electron release channel (H5)

---

## Files changed during this audit

- `android/.../AuthRepository.kt` — recovery paths → `/api/auth/recovery/*`

---

*Report generated with ruff, pytest, jest, knip, eslint, semgrep, Gradle, live HTTPS probes, and codebase explore agent.*
