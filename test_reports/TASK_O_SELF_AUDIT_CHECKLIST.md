# TASK O — Structured self-audit checklist (O.5)

**Date:** 2026-06-27 · **Build:** v1.0.9 · **Auditor:** founder + agent

Mark each item PASS / FAIL / N/A with evidence (screenshot, log, or test name).

## O.1 — RSA send retired on installed clients

- [ ] Android APK cannot send new `legacy_rsa` messages (only decrypt old)
- [ ] Windows desktop cannot send new `legacy_rsa` messages
- [ ] Stories post uses Signal on installed when contacts ready
- [ ] `maySendLegacyRsa()` returns false on installed clients

## O.2 — Group call signaling encrypted

- [ ] Group call offer/answer/ICE use `signaling_protocol: signal_v1` when sender keys ready
- [ ] Off-LAN group call still connects (after P.6)

## O.3 — Hardware-backed device wrap

- [ ] Windows: device wrap key in Electron `safeStorage` (not plaintext localStorage) — *evidence: `deviceWrapCrypto.test.js` migration + `vaultCredentialStore.test.js` hardware path; manual TASK J*
- [ ] Android: `SscDeviceSecret` EncryptedSharedPreferences used — *evidence: `SscDeviceSecretPlugin.java` + `deviceWrapCrypto.test.js`; manual TASK J*
- [ ] Session restore works after app restart — *evidence: `sessionStore.test.js`, `nativeSessionStore.test.js`*
- [ ] Panic wipe clears device secrets — *evidence: `clientFootprintOrchestrator.test.js` panic path*

## O.4 — Security UI

- [ ] No RSA/SIG badge clutter in default chat composer
- [ ] Verify identity reachable from profile sheet only (not header)
- [ ] `VerifyHandshakeModal` QR is local (no external QR API)

## O.5 — Abuse & ops

- [ ] Turnstile on register/login (production)
- [ ] Rate limits return 429 under burst (see `test_reports/rate_limit_smoke_2026-06-26.json`)
- [ ] Retention janitor attestation endpoint healthy
- [ ] GCP log alerts configured (P.10 optional)

## O.6 — Mongo network

- [x] GCP static egress **34.140.240.41** + VPC connector + Cloud Run `all-traffic` egress
- [x] Runbook + automation (`scripts/ATLAS_NETWORK_HARDENING.md`, `apply_atlas_ip_allowlist.py`)
- [x] Atlas: `34.140.240.41/32` + `86.166.40.195/32` only — `0.0.0.0/0` removed (27 Jun 2026)

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Founder | | | |
| Agent | | | |