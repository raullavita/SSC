# SSC Product Blueprint — aligned with roadmap

**Version:** 2.1 · **Updated:** 2026-06-26  
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
| 1 | **Ephemeral by default** — 24h global retention enforced server-side | Engine 1 ✅ · user picker → TASK M.6 |
| 2 | **No vault UX** — crypto runs silently; RSA wrap is internal only | TASK A ✅ |
| 3 | **Simple onboarding** — username + Google or email/password; no phone number | ✅ |
| 4 | **Panic wipe** — serious emergency; clears content, keeps account | Engine 3 ✅ |
| 5 | **libsignal on installed clients** — primary E2E story | Engine 8 ✅ · RSA retire → TASK O.1 |
| 6 | **Professional feel** — profile, Settings, landing trust | TASK M, N |

---

## What users see today (v1.0.7)

### Onboarding
- Google sign-in or email/password register
- Username setup (permanent)
- Silent Signal identity bootstrap on installed clients

### Chat
- Mutual contacts only
- 1:1 + groups, attachments, voice notes, calls, stories
- Block / mute per contact
- Tap peer avatar → profile sheet (mute / block)
- Retention badge: “Auto-delete in 24h” (read-only)

### Settings
- Profile: avatar, email, locked username, language
- Security: messages protected status, 2FA, panic wipe, auto-delete info
- Blocked contacts list
- Push notifications enable
- Help: contact@supersecurechat.com
- About: version, open-source link

### Web (supersecurechat.com)
- Marketing landing + Privacy + Terms
- No browser-tab chat (installed apps only)

---

## Technical truth (honest — matches SECURITY_MODEL.md)

| Topic | User-facing | Internal reality | Finish line |
|-------|-------------|------------------|-------------|
| Messaging E2E | “Messages protected” | libsignal on installed; legacy RSA dual-read | TASK O.1 |
| Vault | Hidden | RSA wrap on server; auto-unlock on device | stays internal |
| Group calls | Works | SDP/ICE may be cleartext on server | TASK O.2 |
| Session | Stays logged in | JWT in memory + AES device wrap | TASK O.3 keystore |
| Retention | 24h shown | Global TTL; not per-user yet | TASK M.6 |
| Translation | On-device Android | Server translation off in prod | ✅ |

---

## Infrastructure (production)

| Piece | Status |
|-------|--------|
| API | Cloud Run `ssc-api-00016-mgl` |
| DB | MongoDB Atlas `ssc` |
| Sessions / rate limits | Upstash Redis |
| Push | Firebase FCM |
| Marketing site | `www.supersecurechat.com` (Firebase Hosting) |
| API domain | **Pending** `api.supersecurechat.com` (TASK P.3) |
| Turnstile | **Pending** (TASK P.1–P.2) |
| Play Store | **Pending** (TASK I.6) |

---

## Workstreams → roadmap tasks

| Blueprint goal | Roadmap task | Status |
|----------------|--------------|--------|
| Ephemeral messaging default | Engine 1, I.4 | ✅ server · [~] founder thread proof |
| Remove vault from UX | TASK A | ✅ code |
| Polished onboarding | TASK G, SetupUsername | ✅ |
| libsignal universal (installed) | Engine 8, TASK O.1 | ✅ send path · RSA retire open |
| Configurable retention | TASK M.6 | [ ] v1.1 |
| Panic wipe | Engine 3 | ✅ |
| Clean UI / Settings | TASK H, **TASK M** | [~] M.1–M.4 done |
| Public domain + legal | **TASK N**, I.1 | [~] site live; legal pages added |
| Production hosting | Cloud Run + Firebase | ✅ |
| Real-device QA | **TASK J** | [ ] paused |
| Crypto hardening | **TASK O** | [ ] |
| Founder infra setup | **TASK P** | [ ] checklist |

---

## UX / design direction

- **Calm, dark, monospace accents** — existing SSC design system
- **No security jargon** in default UI
- **References:** WhatsApp flow, Telegram speed — privacy-first core
- **Avoid:** coded panels, VERIFY/QR in chat, version placeholders on landing

---

## Phased delivery (same as roadmap)

1. **Trust perimeter** — Turnstile, API domain, email, downloads (TASK P, L.7, N)
2. **In-app polish** — profile, Settings, errors (TASK M)
3. **Crypto hardening** — RSA retire, group signaling, keystore (TASK O)
4. **Founder QA** — smashmaxxx ↔ dots (TASK J)
5. **Wider rollout** — App Distribution, Play Store (I.6, N.8)

---

## What we do not claim (yet)

- Audited like Signal or WhatsApp
- iOS shipped
- Multi-device sync
- Sealed sender
- Public launch ready without TASK J + Turnstile + legal + TURN proof