# Live SFU / TURN — production state (2026-07-19)

## Status: operational without Porkbun (temporary WSS host)

| Component | Value | Status |
|-----------|--------|--------|
| GCE `ssc-sfu` | static **`35.195.79.31`** (`ssc-sfu-ip`) | RUNNING |
| SFU mediasoup | `:4443` HTTP health | **ok** |
| WSS (clients) | **`wss://35-195-79-31.sslip.io`** | LE cert issued via Caddy |
| API `SSC_SFU_WS_URL` | same sslip URL | **live on `/api/health`** |
| API `SSC_SFU_INTERNAL_URL` | `http://35.195.79.31:4443` | **ok** |
| TURN/STUN | `turn:35.195.79.31:3478` / `stun:35.195.79.31:3478` | **TCP 3478 open**, coturn running |
| Cloud Run | revision with full env restored + TURN | **healthy** |

### Why sslip.io?

Porkbun holds DNS for `supersecurechat.com` and we have **no Porkbun API keys** in the repo.  
`35-195-79-31.sslip.io` → `35.195.79.31` (public DNS 8.8.8.8 / 1.1.1.1) with a real Let's Encrypt cert.  
Verified: `curl --resolve 35-195-79-31.sslip.io:443:35.195.79.31 https://…/health` → **ok**.

**Note:** Some ISPs (e.g. SafeSurf/GlobalConnect) rewrite `*.sslip.io` in recursive DNS. Phones using normal/carrier DNS or Private DNS → 8.8.8.8 are fine. Your PC may not resolve sslip correctly — use Porkbun A records for a bulletproof name.

### Recommended Porkbun (2 minutes, optional but best)

```
A  sfu   →  35.195.79.31
A  turn  →  35.195.79.31
```

Then reply “DNS done” and we switch API to `wss://sfu.supersecurechat.com` / `turn:turn.supersecurechat.com:3478`.  
Caddy already includes `sfu.supersecurechat.com` for when DNS is fixed.

---

## What was done for you

1. Redeployed SFU image (existingProducers harden + fixed Dockerfile)  
2. Static IP so announced IP stops drifting  
3. `SFU_ANNOUNCED_IP` aligned  
4. coturn TURN on same VM + firewall `ssc-turn`  
5. Caddy TLS for sslip WSS  
6. Cloud Run: SFU + TURN env (full env restored after a bad wipe)  
7. Android client harden already in tree  

---

## Optional — only you (Porkbun UI, 2 minutes)

1. Log into Porkbun → `supersecurechat.com` DNS  
2. Set A records above  
3. Reply “DNS done” — we switch API URLs to pretty hostnames  

No Mac / stores needed for testing.

---

## How to test group SFU now

1. Install latest Android APK (`android/app/build/outputs/apk/debug/app-debug.apk`)  
2. Two accounts in one **group**  
3. Start call / video  
4. Peer should get SFU invite → Answer  
5. If audio fails on cellular, TURN is already configured by IP  

Logcat tags: `SfuSession`, `SfuMediaEngine`, `CallCoordinator`.
