# Security policy

## Reporting vulnerabilities

If you find a security issue in SSC, please **do not** open a public GitHub issue with exploit details.

1. Open a [GitHub Security Advisory](https://github.com/raullavita/SSC/security/advisories/new) (preferred), or
2. Email **contact@supersecurechat.com** with a clear description and reproduction steps.

We will acknowledge reports as soon as we can. Please allow time for a solo-maintainer project.

## What must never be committed

| Secret | Where it lives |
|--------|----------------|
| `MONGO_URL`, `JWT_SECRET`, `CONTACT_GRAPH_PEPPER` | `backend/.env`, `backend/cloud_run.env` |
| `GOOGLE_CLIENT_SECRET`, Firebase service account JSON | `backend/.env`, `backend/firebase/` |
| `TURNSTILE_SECRET`, `TURN_CREDENTIAL`, `VAPID_PRIVATE` | `backend/.env`, `cloud_run.env` |
| `REDIS_URL` (contains token) | `cloud_run.env` |
| Android release keystore | `frontend/android/keystore.properties`, `*.jks` |
| `google-services.json` | `frontend/android/app/` |
| Site preview / construction passwords | `frontend/.env.production.local` |
| Personal tester email lists | `scripts/firebase_testers.txt` |

Copy from `*.example` files only. If a secret was ever committed, **rotate it** (new JWT, DB password, OAuth secret, etc.) — removing from git history alone is not enough.

## Public vs private

- **Source code** is intended to be public (AGPL-3.0 + libsignal obligations on distributed APK).
- **Production credentials** stay on the maintainer's machine and in Cloud Run / Firebase console — not in the repo.
- **User message plaintext** is never stored on the server; user private keys are password-encrypted client-side before upload.

## Safe contribution areas

Help is welcome on: encryption flows, WebRTC signaling, Android/Electron libsignal, tests, i18n, accessibility, and documentation. Do not paste production URLs with tokens or personal emails in PRs.

## GitHub Security tab (Dependabot + CodeQL)

A high alert count on a public repo is **normal** after enabling Dependabot and CodeQL — especially with Create React App (`react-scripts`), which pulls in many transitive dev dependencies.

### What the numbers mean

| Source | What it scans | Typical noise |
|--------|----------------|---------------|
| **Dependabot alerts** | CVEs in `yarn.lock` / `requirements.txt` | `nth-check`, `underscore`, `serialize-javascript` via webpack — **build-time only** |
| **Code scanning (CodeQL)** | Patterns in our Python/JS source | Intentional `localStorage` in vault/session stores; OAuth redirects; test fixtures |

SSC is **install-only** (APK + desktop). Browser-tab chat is blocked. Many react-router CVEs target **SSR / framework mode**, which we do not use.

### Priority for contributors

1. **Direct runtime deps** in `frontend/package.json` — e.g. `axios`, `react-router-dom` — patch/minor bumps + `yarn test:ci`
2. **Backend** `pip` direct deps — small grouped Dependabot PRs after CI passes
3. **Desktop** `electron` — upgrade deliberately (rebuild desktop), not blind major jumps
4. **Transitive CRA/webpack alerts** — often cannot fix without migrating off `react-scripts`; document and defer
5. **CodeQL** — triage: dismiss false positives (tests, encrypted vault storage) with a one-line reason; fix real issues in focused PRs

### What not to do

- Do not merge every Dependabot PR at once (especially **major** bumps: Tailwind 4, Capacitor 8, Electron 33→42).
- Do not treat alert count as “the app is hacked.”
- Do not open public issues with exploit write-ups — use [Security Advisories](https://github.com/raullavita/SSC/security/advisories/new) instead.

### Maintainer workflow (monthly is fine)

1. Review [Dependabot alerts](https://github.com/raullavita/SSC/security/dependabot) — filter **Direct**, sort by severity.
2. Merge small patch PRs when **CI** and **CodeQL** are green.
3. Dismiss CodeQL false positives on the [Code scanning](https://github.com/raullavita/SSC/security/code-scanning) tab with a short note.
4. Rebuild APK/desktop after client dependency changes that ship to users.

### SSC triage snapshot (29 Jun 2026)

| Alert bucket | Count | Action |
|--------------|-------|--------|
| **Electron** (desktop devDep, pinned 33.4.11) | ~17 open | **Deferred** — patches require Electron 38+; rebuild + QA before bump |
| **Encrypted client storage** (CodeQL) | ~6 | **False positive** — AES-GCM ciphertext / locale codes; suppressions in source |
| **pymongo** | 1 | **Fixed** — bumped to 4.6.3 (CVE-2024-5629) |
| **serialize-javascript** (transitive) | 1 | **Fixed** — yarn resolution `7.0.3` on `main` |
| **Log injection** (CodeQL, backend) | ~10 | **Low risk** — structured logs; user input not written raw to clients |
| **Tests / seed scripts** | ~4 | **Excluded** — `.github/codeql/codeql-config.yml` paths-ignore |

Dependabot may still show counts against an **older commit** until GitHub re-scans `main` (refresh the Security tab after the latest push).

### Next upgrades (when someone has time)

- Remaining transitive alerts under `react-scripts` (long-term: CRA migration or eject)
- Controlled Electron bump in `frontend/desktop` (test `SSC-BUILD-DESKTOP-WIN.bat`)
- Backend grouped minor/patch Dependabot PRs (`/backend`)

## Branch protection (`main`)

`main` is protected on GitHub:

- **Required checks:** `Frontend tests`, `Backend tests` (must pass; branch must be up to date)
- **Blocked:** force-push, branch deletion
- **Allowed:** direct push by maintainer when CI is green (no PR required for solo work)
- **Script:** `scripts/github-protect-main.ps1` (re-apply after `gh auth login` if settings are reset)