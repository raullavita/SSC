# TASK O — Structured self-audit checklist (O.5)

**Date:** 2026-06-26 · **Build:** v1.0.8 · **Auditor:** founder + agent

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

- [ ] Windows: device wrap key in Electron `safeStorage` (not plaintext localStorage)
- [ ] Android: `SscDeviceSecret` EncryptedSharedPreferences used
- [ ] Session restore works after app restart
- [ ] Panic wipe clears device secrets

## O.4 — Security UI

- [ ] No RSA/SIG badge clutter in default chat composer
- [ ] Verify identity reachable from profile sheet only (not header)
- [ ] `VerifyHandshakeModal` QR is local (no external QR API)

## O.5 — Abuse & ops

- [ ] Turnstile on register/login (production)
- [ ] Rate limits return 429 under burst (see `test_reports/rate_limit_smoke_2026-06-26.json`)
- [ ] Retention janitor attestation endpoint healthy
- [ ] GCP log alerts configured (P.10 optional)

## O.6 — Mongo network (when scaling)

- [ ] Atlas IP access list documents Cloud Run egress (see `scripts/ATLAS_NETWORK_HARDENING.md`)
- [ ] No `0.0.0.0/0` on production cluster (post-scale goal)

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Founder | | | |
| Agent | | | |