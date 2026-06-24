# Third-party notices — SSC

SSC (Super Secure Chat) is licensed under the **GNU Affero General Public License v3.0**.  
See [LICENSE](LICENSE) and [memory/AGPL_COMPLIANCE.md](memory/AGPL_COMPLIANCE.md).

Source code: **https://github.com/raullavita/SSC**

---

## Copyleft components (AGPL-3.0)

These libraries are **linked or bundled** in conveyed builds and require corresponding source under AGPL.

### libsignal (Signal Foundation)

| Field | Value |
|-------|-------|
| **Components** | `org.signal:libsignal-android`, `org.signal:libsignal-client`, `@signalapp/libsignal-client` |
| **Version pinned** | **0.96.2** |
| **License** | [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) |
| **Upstream** | https://github.com/signalapp/libsignal |
| **Android Maven** | https://build-artifacts.signal.org/libraries/maven/ |
| **npm** | https://www.npmjs.com/package/@signalapp/libsignal-client |
| **SSC usage** | Android APK: X3DH, Double Ratchet, Sender Keys via `SscLibsignalPlugin` |
| **Corresponding source** | This repository + upstream libsignal tag `v0.96.2` |

### mediasoup (planned — SFU Phase B)

| Field | Value |
|-------|-------|
| **Component** | mediasoup server + client integration |
| **License** | [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) |
| **Upstream** | https://github.com/versatica/mediasoup |
| **SSC usage** | Planned self-hosted SFU for group calls >6 participants (`memory/SFU_CHARTER.md`) |
| **Status** | **Not deployed** — listed for future compliance |

---

## Other notable dependencies (permissive / proprietary SDK terms)

| Component | License / terms | SSC usage |
|-----------|-----------------|-----------|
| React, React DOM | MIT | Web UI |
| Capacitor | MIT | Android/iOS shell |
| axios | MIT | HTTP client |
| FastAPI, Uvicorn, PyMongo, Redis, etc. | Permissive (MIT/BSD/Apache) | Backend API |
| Google ML Kit Translate | [Google APIs Terms of Service](https://developers.google.com/ml-kit/terms) | On-device translation (Android) |
| Firebase / FCM | Google Firebase Terms | Push notifications |
| Phosphor Icons | MIT | UI icons |

For full dependency trees, see `frontend/yarn.lock` and `backend/requirements.txt`.

---

## How to obtain source

1. **SSC application source:** clone https://github.com/raullavita/SSC (branch/tag matching your installed version).
2. **libsignal source:** https://github.com/signalapp/libsignal at tag **v0.96.2**.
3. **In-app:** Settings → Open source.