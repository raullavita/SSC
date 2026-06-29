# AGPL compliance review — SSC Play Store readiness

**Version:** 1.0  
**Effective:** 2026-06-24  
**Status:** ✅ Review complete — artifacts in repo; founder pastes Play Store text at listing time  
**Disclaimer:** Engineering compliance checklist, not legal advice. Consult counsel before commercial launch.

---

## 1. Executive summary

| Question | Answer |
|----------|--------|
| Does SSC trigger AGPL? | **Yes** for the **Android APK** — it links `org.signal:libsignal-android` / `libsignal-client` **0.96.4** (AGPL-3.0) via native `.so` in the distributed binary. |
| Does web/PWA trigger AGPL from libsignal? | **No (today)** — official libsignal is not shipped in the browser build (Engine 8.10 blocked). Web uses `legacy_rsa` only. |
| Does the backend API trigger AGPL? | **Not as a separate conveyance** — backend does not link libsignal. If SSC later modifies AGPL server code (e.g. mediasoup SFU) and runs it as a network service users interact with, **AGPL §13** may require source offer for that service too. |
| Blocks private beta / Firebase App Distribution? | **No** — AGPL applies whenever you **convey** copies (including testers). Compliance artifacts below satisfy conveyance obligations. |
| Blocks public Play Store? | **No** — with root `LICENSE`, `THIRD_PARTY_NOTICES.md`, public GitHub source, and in-app source link (Settings → Open source). |

**Decision:** License the **conveyed Android application** (SSC + bundled AGPL deps) under **AGPL-3.0**. Keep source public at `https://github.com/raullavita/SSC`.

---

## 2. AGPL touchpoints (audited 24 Jun 2026)

### 2.1 Shipped today (Android APK)

| Component | Version | License | Where |
|-----------|---------|---------|-------|
| **libsignal** (Rust + JNI) | **0.96.4** | AGPL-3.0 | `frontend/android/app/build.gradle`; `libsignal_jni.so` in APK |
| SSC Capacitor plugin | — | AGPL-3.0 (combined work) | `SscLibsignalPlugin.java`, `SscSignalStore.java` |
| SSC app UI + crypto glue | — | AGPL-3.0 (combined work) | `frontend/src/lib/signal/*`, Android WebView bundle |

Pinned versions must match `backend/core/signal_policy.py` (`LIBSIGNAL_PINNED_VERSION`) and `backend/core/agpl_policy.py`.

### 2.2 Dev / CI only (not in production web bundle)

| Component | Version | License | Notes |
|-----------|---------|---------|-------|
| `@signalapp/libsignal-client` | 0.96.4 | AGPL-3.0 | `optionalDependencies` in `frontend/package.json`; Node/tests |

### 2.3 Planned (not deployed)

| Component | License | Trigger |
|-----------|---------|---------|
| **mediasoup** SFU (Phase B) | AGPL-3.0 | When SSC deploys self-hosted mediasoup and distributes client code linking to it |

See `memory/SFU_CHARTER.md` — mediasoup is AGPL-3.0 (compatible stack, not license exemption).

### 2.4 Permissive deps (not copyleft triggers)

Backend (`requirements.txt`): FastAPI, PyMongo, Redis client, etc. — permissive licenses.  
Android ML Kit Translate: Google Terms of Service / SDK license (not AGPL).  
Capacitor, React, axios, etc.: MIT/Apache-style.

These do not force AGPL on SSC by themselves; **libsignal linkage** does.

---

## 3. Corresponding source (what to publish)

For each Android APK conveyance, recipients must be able to obtain **Corresponding Source** (AGPL §1, §6):

| Include | Path / note |
|---------|-------------|
| Frontend source | `frontend/` |
| Android native + Capacitor | `frontend/android/` |
| Backend (reproducible stack) | `backend/`, `docker-compose.yml` |
| Build instructions | `README.md`, `SSC-BUILD-APK.bat`, `yarn cap:sync` |
| Policy / charters | `memory/` |
| Exact dependency pins | `yarn.lock`, `requirements.txt`, `build.gradle` libsignal **0.96.4** |
| License texts | `LICENSE`, `THIRD_PARTY_NOTICES.md` |

**Source offer mechanism (chosen):** public GitHub repo — satisfies AGPL §6(d) when linked prominently in-app and on Play Store listing.

---

## 4. Compliance artifacts (implemented)

| ID | Artifact | Location |
|----|----------|----------|
| L1 | Compliance review | `memory/AGPL_COMPLIANCE.md` (this file) |
| L2 | Project license | `LICENSE` (AGPL-3.0) |
| L3 | Third-party notices | `THIRD_PARTY_NOTICES.md` |
| L4 | Machine-readable policy | `backend/core/agpl_policy.py` |
| L5 | Policy tests + gate | `backend/tests/test_agpl_policy.py`, `scripts/run_agpl_gate.py` |
| L6 | In-app source + notices | Settings → **Open source** (`frontend/src/lib/openSourceLicenses.js`) |

---

## 5. Play Store listing (founder — paste at publish)

**Short description footer (optional):**
> Open-source secure chat. Source code: https://github.com/raullavita/SSC (GNU AGPL v3).

**Full description snippet:**
> SSC (Super Secure Chat) is licensed under the GNU Affero General Public License v3.0.  
> Source code for the version you install is available at:  
> **https://github.com/raullavita/SSC**  
>  
> This app includes libsignal (Signal Foundation, AGPL-3.0) for end-to-end encryption on Android.  
> See in-app Settings → Open source for license details.

**Data safety / declarations:** Declare open-source licensing where Google Play asks; link repository in "Website" or developer contact fields.

---

## 6. Ongoing obligations

1. **Keep GitHub public** (or offer equivalent network source) for every APK version shipped to users.
2. **Tag releases** matching `versionName` / `versionCode` in `build.gradle` when publishing to Play Store.
3. **Pin libsignal** — bump only with charter update + `agpl_policy` / `signal_policy` sync.
4. **mediasoup Phase B** — extend `THIRD_PARTY_NOTICES.md` and in-app list when SFU ships; if SSC modifies mediasoup server, comply with AGPL §13 for network interaction.
5. **Re-run gate** after license-related changes: `python scripts/run_agpl_gate.py`.

---

## 7. What AGPL does *not* require (for SSC today)

- Re-licensing the **web-only** PWA under AGPL solely because the same repo contains Android code (no libsignal in web binary).
- Publishing server API source to every HTTP client **unless** that server code is AGPL-covered *and* modified for public use (future mediasoup case).
- Blocking **private development** or LAN testing without conveyance to third parties.

---

## 8. Sign-off

| Check | Status |
|-------|--------|
| AGPL deps identified | ✅ libsignal 0.96.4 (Android); mediasoup planned |
| Combined work license chosen | ✅ AGPL-3.0 (`LICENSE`) |
| Source offer path | ✅ GitHub public repo |
| In-app legal notices | ✅ Settings UI |
| Third-party attribution | ✅ `THIRD_PARTY_NOTICES.md` |
| Automated policy gate | ✅ `run_agpl_gate.py` |
| Play Store copy drafted | ✅ §5 above |

**P1 roadmap item "AGPL legal review" — complete.**