# Unified identity charter

**Version:** 1.0  
**Effective:** 2026-06-24  
**Scope:** One user-facing identity — libsignal Curve25519 primary on installed clients

---

## 1. Decision

| Layer | Role |
|-------|------|
| **libsignal identity (Curve25519)** | Primary — safety numbers, prekeys, Signal messaging, verification |
| **RSA 2048 key pair** | **Vault wrap only** — `encrypted_private_key` unlock; legacy file envelope fallback until retired |
| **Browser tab** | Not a registration surface |

Founder may **reset 3 tester accounts** after deploy — no mass migration.

---

## 2. Server fields

| Field | Meaning |
|-------|---------|
| `signal_identity_key_public` | Canonical identity bytes (from prekey bundle) |
| `signal_prekeys_ready` | `true` after `PUT /keys/prekey-bundle` |
| `identity_primary` | `signal_v1` when unified path complete |
| `public_key` | RSA JWK — vault / legacy envelope only (not shown as user identity) |

---

## 3. Client rules (installed clients)

1. Registration / Google finish-setup → RSA vault created (unchanged).
2. **Before `/chat`:** `ensurePreKeysUploaded()` must succeed.
3. Safety numbers / verify UI use **Signal identity only** when `identity_primary === signal_v1`.
4. No dual RSA+Curve fingerprint shown to users on installed apps.

---

## 4. Engine step

| Step | Description | Status |
|------|-------------|--------|
| UI.1 | Charter + `unified_identity_policy.py` + gate | ✅ |
| UI.2 | `identity_primary` on prekey upload | ✅ |
| UI.3 | Installed registration blocks until prekeys ready | ✅ |
| UI.4 | Verify UI labels + `resolveUserIdentity` prefers signal | ✅ |
| UI.5 | Browser product gate (no web register/chat) | ✅ |