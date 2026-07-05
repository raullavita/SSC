# Third-party notices

SSC builds on open-source software. This document satisfies attribution requirements for key runtime dependencies.

## Signal libsignal (AGPL-3.0) — required notice

SSC uses [Signal libsignal](https://github.com/signalapp/libsignal) for end-to-end encryption:

| Platform | Package | Version (pinned) |
|----------|---------|------------------|
| Windows / Electron | `@signalapp/libsignal-client` | 0.96.4 |
| Android | `org.signal:libsignal-android` | 0.96.4 |

libsignal is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. Modified versions used to provide a network service must make corresponding source available to users interacting with that service over a network.

- **Upstream source:** https://github.com/signalapp/libsignal  
- **SSC source (includes libsignal integration):** https://github.com/raullavita/SSC  
- **SSC license:** [LICENSE](LICENSE) (AGPL-3.0)

## Other key dependencies

| Component | License | Project |
|-----------|---------|---------|
| mediasoup | ISC | https://mediasoup.org/ |
| FastAPI | MIT | https://fastapi.tiangolo.com/ |
| React | MIT | https://react.dev/ |
| Electron | MIT | https://www.electronjs.org/ |
| Firebase Admin SDK | Apache-2.0 | https://firebase.google.com/ |

Full dependency trees: `backend/requirements.txt`, `frontend/package.json`, `electron/package.json`, `sfu-server/package.json`.