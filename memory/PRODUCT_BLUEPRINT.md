# SSC Product Blueprint — aligned with roadmap

**Version:** 2.2 · **Updated:** 2026-06-27  
**Single execution source:** `memory/SSC-ROADMAP.md` (TASK A–P)  
**Public brand:** Super Secure Chat · **supersecurechat.com**

---

## Vision

SSC is a privacy-first, ephemeral messaging app for **installed clients** (Android, Windows, Mac):

- chats, files, and call traces expire automatically (24h default today)
- users never see vaults, keys, or crypto jargon
- the experience should feel as simple as WhatsApp or Telegram — calmer and more private

This is a real consumer product in **founder + closed tester** phase, not a public-launch giant yet.

---

## Product principles (locked)

| # | Principle | Roadmap |
|---|-----------|---------|
| 1 | **Ephemeral by default** — 24h global retention enforced server-side | Engine 1 ✅ · user picker → TASK M.6 v1.1 |
| 2 | **No vault UX** — crypto runs silently; RSA wrap is internal only | TASK A ✅ |
| 3 | **Simple onboarding** — username + Google or email/password; no phone number | ✅ |
| 4 | **Panic wipe** — serious emergency; clears content, keeps account | Engine 3 ✅ |
| 5 | **libsignal on installed clients** — primary E2E story | Engine 8 ✅ · RSA send blocked → TASK O.1 ✅ |
| 6 | **Professional feel** — profile, Settings, landing trust | TASK M ✅, TASK N ✅ |

---

## What users see today (v1.0.9)

### Onboarding
- Google sign-in or email/password register
- Username setup (permanent)
- Silent Signal identity bootstrap on installed clients

### Chat
- Mutual contacts only
- 1:1 + groups, attachments, voice notes, calls, stories
- Block / mute per contact
- Tap peer avatar → profile sheet (mute / block / **verify identity**)
- Retention badge: “Auto-delete in 24h” (read-only)

### Settings
- Profile: avatar, email, locked username, language
- Security: messages protected status, 2FA, panic wipe, delete account, auto-delete info
- Blocked contacts list
- Push notifications enable
- Help: contact@supersecurechat.com
- About: version, open-source link

### Web (supersecurechat.com)
- **Construction gate** (password for invitees) — public walk-ins blocked
- Marketing landing + Privacy + Terms (after bypass)
- Direct `/downloads/` APK/EXE URLs still public by design
- No browser-tab chat (installed apps only)

---

## Technical truth (honest — matches SECURITY_MODEL.md)

| Topic | User-facing | Internal reality | Status |
|-------|-------------|------------------|--------|
| Messaging E2E | “Messages protected” | libsignal on installed; RSA send blocked; dual-read decrypt legacy | O.1 ✅ |
| Vault | Hidden | RSA wrap on server for account recovery path | internal |
| Group calls | Works | signal_v1 signaling when sender keys ready; cleartext fallback | O.2 ✅ client |
| Session | Stays logged in | JWT in memory + AES device wrap + hardware store | O.3 ✅ |
| Retention | 24h shown | Global TTL; not per-user yet | M.6 v1.1 |
| Translation | On-device Android | Server translation off in prod | ✅ |
| Mongo network | Cloud Run NAT **34.140.240.41** | Atlas locked (2 IPs only) | O.6 ✅ |

---

## Infrastructure (production — verified 27 Jun 2026)

| Piece | Status |
|-------|--------|
| API | Cloud Run `ssc-api-00021-6k6` · `https://api.supersecurechat.com` |
| Health | mongo ✅ · redis ✅ · ws_fanout redis |
| DB | MongoDB Atlas `ssc` |
| Sessions / rate limits | Upstash Redis |
| Push | Firebase FCM |
| Marketing site | `www.supersecurechat.com` (Firebase Hosting) |
| Turnstile | ✅ production register/login |
| Email | `contact@supersecurechat.com` inbound OK |
| Play Store | **Deferred** next week (TASK I.6 / N.8) |

---

## Workstreams → roadmap tasks

| Blueprint goal | Roadmap task | Status |
|----------------|--------------|--------|
| Ephemeral messaging default | Engine 1, I.4 | ✅ server · [~] founder thread proof |
| Remove vault from UX | TASK A | ✅ |
| Polished onboarding | TASK G | ✅ |
| libsignal universal (installed) | Engine 8, TASK O.1 | ✅ |
| Configurable retention | TASK M.6 | [ ] v1.1 |
| Panic wipe | Engine 3 | ✅ |
| Clean UI / Settings | TASK M | ✅ M.1–M.11 |
| Public domain + legal | TASK N | ✅ N.1–N.7 |
| Construction gate | TASK N + siteGate | ✅ password bypass |
| Production hosting | Cloud Run + Firebase | ✅ |
| Real-device QA | TASK J | [ ] scheduled 27 Jun |
| Crypto hardening | TASK O | ✅ O.1–O.6 (GCP NAT; Atlas allowlist script) |
| Founder infra setup | TASK P | [~] P.1–P.7 ✅ · P.6/P.8–P.10 open |

---

## Codebase housekeeping (for future devs)

Large files that should be split in a future refactor (not blocking launch):

| Lines | File | Suggested split |
|------:|------|-----------------|
| ~1,790 | `ChatHome.jsx` | hooks: socket, messages, calls, contacts; sub-views |
| ~1,440 | `i18n.js` | per-locale JSON or `locales/en.js` etc. |
| ~540 | `SettingsModal.jsx` | section components (Security, Profile, …) |
| ~430 | `auth.py` | register/oauth vs session vs delete-account routers |

---

## UX / design direction

- **Calm, dark, monospace accents** — existing SSC design system
- **No security jargon** in default UI
- **References:** WhatsApp flow, Telegram speed — privacy-first core
- **Avoid:** VERIFY/QR in chat header (profile sheet only)

---

## Phased delivery (same as roadmap)

1. **Trust perimeter** — Turnstile, API domain, email, downloads ✅
2. **In-app polish** — profile, Settings, errors ✅
3. **Crypto hardening** — RSA send block, group signaling, keystore ✅
4. **Founder QA** — smashmaxxx ↔ dots (TASK J) ← **now**
5. **Wider rollout** — App Distribution, Play Store (next week)

---

## What we do not claim (yet)

- Audited like Signal or WhatsApp
- iOS shipped
- Multi-device sync
- Sealed sender
- Public launch ready without TASK J green + P.6 TURN proof
- Website open to public (construction gate on until flow ≥90%)