# Q.64 — TASK J full device matrix

**Gate:** Release candidate after **Q.1–Q.15** minimum, tested on installed clients only.

**Primary devices:** `tester-win` (Windows desktop) ↔ `tester-android` (Android APK)

**Stretch (optional):** `tester-mac`, `tester-ios` when builds are available (Q.61 / Q.63).

**API:** `https://api.supersecurechat.com` (or `SSC_API_URL` override)

---

## Before you start

1. Run automated preflight:
   ```powershell
   .\scripts\run_device_matrix.ps1
   ```
2. Install the **same release candidate version** on both primary devices (`device-matrix/RELEASE_CANDIDATE.json`).
3. Use **Google sign-in** on installed clients (no browser-tab product).
4. Open a DM and wait ~5s (Signal bootstrap) before first send or call.
5. Log every row in `test_reports/Q64_DEVICE_MATRIX.md`.

---

## Full matrix

| ID | Area | Test | Depends | Win | Android | Pass | Notes |
|----|------|------|---------|-----|---------|------|-------|
| auth_google_both | Auth | Google login both devices | — | | | | |
| auth_persist_force_close | Auth | Stay logged in after force-close | TASK B | | | | |
| auth_google_only_email_error | Auth | Google-only email login shows friendly error | H.5 | | | | |
| contacts_friend_request | Contacts | Friend request live (send + accept) | TASK C | | | | |
| chat_dm_realtime | Chat | 1:1 text real-time | — | | | | |
| chat_no_legacy_ui | Chat | No vault / legacy / upgrade UI | TASK A | | | | |
| chat_media_roundtrip | Chat | Image + voice note + file | TASK E | | | | |
| chat_block_mute | Chat | Block + mute | TASK F | | | | |
| groups_create_message | Groups | Create + name + message | TASK F | | | | |
| calls_voice_video_ring | Calls | Voice + video duplex + ring | TASK D | | | | |
| stories_post_expiry | Stories | Post + 24h expiry | — | | | | |
| security_panic_wipe | Security | Panic wipe (data gone, account remains) | — | | | | |
| security_2fa | Security | 2FA enable + login | — | | | | |
| push_background | Push | Message + friend request when backgrounded | TASK C | | | | |
| translate_on_device | Translate | On-device Android (different languages) | — | | | | |
| retention_24h | Retention | Messages gone after 24h | I.4 | | | | |
| nav_android_back | Nav | Android system back correct | TASK G | | | | |
| multi_simultaneous | Multi | Same account phone + desktop simultaneous | — | | | | |
| offline_queue_reconnect | Offline | Queue + reconnect | — | | | | |

**Pass criteria:** Every primary-device row marked **Y** with no P0 regressions. Known limits (Windows FCM, off-LAN TURN) documented — not counted as pass if untested.

---

## Calls submatrix (required when `calls_voice_video_ring` is tested)

Complete `test_reports/Q31_TURN_OFF_LAN_MATRIX.md` (Wi‑Fi ↔ cellular, audio + video).

---

## Sign-off

When all rows pass, set in founder shell:

```powershell
$env:SSC_DEVICE_MATRIX_COMPLETE = "1"
$env:SSC_DEVICE_MATRIX_REPORT_PATH = "test_reports/Q64_DEVICE_MATRIX.md"
```

Redeploy API only if you expose completion via `/api/config` for ops dashboards.