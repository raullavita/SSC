# SFU charter — group calls beyond mesh limit

**Version:** 1.0  
**Effective:** 2026-06-24  
**Scope:** Group voice/video when participant count exceeds full-mesh limit

---

## 1. Current state

| Mode | Limit | Implementation |
|------|-------|----------------|
| **1:1 calls** | 2 peers | WebRTC P2P + STUN/TURN |
| **Group calls** | ~6 participants | Full-mesh WebRTC in `GroupCallModal.jsx` |

Full-mesh means each participant opens N−1 peer connections — workable to ~6, unstable beyond that (CPU, bandwidth, signaling fan-out).

---

## 2. Target

| Participants | Mode | Notes |
|--------------|------|-------|
| 2–6 | **mesh** (current) | No server media; keep working path |
| 7+ | **SFU** | Single upstream per client; server forwards streams |

---

## 3. SFU options evaluated

| Option | Verdict | Notes |
|--------|---------|-------|
| **mediasoup** (self-host) | ✅ **Selected for SSC** | AGPL-3.0 (same copyleft family as libsignal); Node/Rust SFU; pairs with existing WebRTC client |
| **LiveKit Cloud** | ⬜ Deferred | Faster to ship but SaaS cost + egress; revisit if self-host ops too heavy |
| **Jitsi embed** | ❌ Rejected | UX/branding mismatch; heavy iframe model |

**Decision:** Plan **self-hosted mediasoup** as Phase 2 media plane. Until deployed, cap group calls at mesh maximum and surface clear UI when SFU is unavailable.

---

## 4. Implementation phases

| Phase | Description | Status |
|-------|-------------|--------|
| A | Policy + `/api/config` exposes `group_calls` caps | ✅ |
| B | mediasoup server + TURN integration | ⬜ Deferred |
| C | Client `GroupCallModal` SFU join path | ⬜ Blocked on B |

---

## 5. Config contract (Phase A)

```json
"group_calls": {
  "mode": "mesh",
  "max_mesh_participants": 6,
  "sfu_enabled": false,
  "sfu_url": null
}
```

When `sfu_enabled` becomes true, clients with >6 members use SFU URL; otherwise enforce mesh cap.