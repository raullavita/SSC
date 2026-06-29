# Q.31 — TURN off-LAN proof matrix (TASK P.6 / I.3 / L.7)

**Goal:** Prove voice/video calls work when caller and callee are on **different networks** (Wi‑Fi ↔ cellular), using metered.ca TURN relay when direct P2P is blocked.

**Devices:** `tester-win` (installed desktop) ↔ `tester-android` (installed APK)

**Prerequisites**
- API deployed with `TURN_USERNAME` + `TURN_CREDENTIAL` (see `backend/cloud_run.env`)
- Both apps on a release that includes Q.31 ICE path badge in the call UI
- Apps **in foreground** on both sides (Windows has no FCM when closed)
- Mutual contacts; Signal sessions warmed (~5s in chat before calling)

**Automated config gate (run first)**
```powershell
.\scripts\verify_turn_off_lan.ps1
# or
python backend/scripts/turn_proof_smoke.py
```

**During each call:** note the status line — `E2E · TURN relay · MM:SS` means relay was used (expected off-LAN). `direct LAN` only acceptable when both devices share the same LAN.

---

## Matrix

| # | Caller | Callee | Mode | Pass (Y/N) | ICE path shown | Notes |
|---|--------|--------|------|------------|----------------|-------|
| 1 | Wi‑Fi | Cellular | Audio | | | |
| 2 | Wi‑Fi | Cellular | Video | | | |
| 3 | Cellular | Wi‑Fi | Audio | | | |
| 4 | Cellular | Wi‑Fi | Video | | | |

**Pass criteria:** All four rows connect with audible/video media ≥30s without `Connection failed`. Off-LAN rows should prefer **TURN relay** ICE path when NAT prevents host/srflx.

---

## Config smoke evidence

| Check | Result | Date |
|-------|--------|------|
| `/api/config` credentialed relay in `ice_servers` | **PASS** (4 relay URLs) | 2026-06-29 |
| `turn_proof_smoke.py` exit 0 | **PASS** | 2026-06-29 |
| `/api/config` `calls.*` block (post-deploy) | PENDING until API redeploy | |

---

## Sign-off

- [ ] Founder completed matrix on tester-win ↔ tester-android
- [ ] Q.31 marked `[x]` in `memory/SSC-ROADMAP.md`
- [ ] TASK P.6 and I.3 marked done when matrix passes