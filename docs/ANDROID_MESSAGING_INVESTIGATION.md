# Android 1:1 messaging — contributor investigation guide

**Status:** Open · **Priority:** P0 · **Labels:** `help wanted`, `android`, `libsignal`

## Problem summary

On **Android APK**, users can often **receive** messages from Windows desktop peers, but **outbound send fails** with encryption bootstrap errors. Symptoms reported in beta:

1. Toast: *Encryption setup did not finish — restart the app* (`encryptionErrBootstrap`)
2. Toast: *Secure messaging is not available on this device* (`encryptionErrLibsignal`)
3. Inbound peer message appears briefly, then UI shows **tiny red** decrypt failure text
4. After killing the app, **Continue with Google** → *Google sign-in failed — Not authenticated*

Windows desktop (Electron + libsignal bridge) typically works for the same account pair.

## Reproduction (two-account)

| Role | Platform | Account |
|------|----------|---------|
| A | Windows desktop | e.g. `@smash` |
| B | Android APK | e.g. `@Dots` (Google signup) |

1. Install APK from https://www.supersecurechat.com/downloads/SSC-app-release.apk
2. Sign in with Google on Android → complete **username + keys** setup
3. Add mutual contacts (friend request both ways)
4. A sends text to B → observe on Android (decrypt UI)
5. B sends text to A → **expected fail** today on many devices

**Server check:** If MongoDB shows `conversations: 0` / `messages: 0` after testing, sends never reached API or accounts are incomplete (`username: null`, `signal_prekeys_ready: false`).

## Code map (start here)

| Layer | Path | Notes |
|-------|------|-------|
| Send gate | `frontend/src/chat/messagingGate.js` | Blocks send if bootstrap/prekeys/session missing |
| Send hook | `frontend/src/chat/useMessagingSend.js` | Sealed sender + authenticated fallback |
| Bootstrap | `frontend/src/lib/signal/prekeys.js` | `ensurePreKeysUploaded()` |
| Identity boot | `frontend/src/lib/signalIdentityBootstrap.js` | Called from gate + `AuthContext` |
| X3DH | `frontend/src/lib/signal/x3dh.js` | `ensureSignalSession()` |
| Multi-device | `frontend/src/lib/signal/multiDeviceMessaging.js` | Fan-out encrypt per peer device |
| Native plugin | `frontend/android/.../SscLibsignalPlugin.java` | encrypt/decrypt/session |
| Signal store | `frontend/android/.../SscSignalStore.java` | Session persistence on device |
| Session JWT | `frontend/src/lib/sessionStore.js` + `nativeSessionStore.js` + `deviceWrapCrypto.js` | Cold start auth |
| Hardware secrets | `frontend/android/.../SscDeviceSecretPlugin.java` | Wrap key for JWT |
| Google OAuth | `frontend/src/pages/GoogleAuthCallback.jsx` | Exchange + setup redirect |
| Setup | `frontend/src/pages/SetupUsername.jsx` | Username + RSA keys + prekeys |
| Decrypt UI | `frontend/src/components/Message.jsx` | `DECRYPT_FAIL` tiny text |
| API prekeys | `backend/routers/keys.py` | `PUT /keys/prekey-bundle` |

## Hypotheses (unconfirmed — prove or disprove)

1. **Incomplete server account** — Google user exists without `username` / `public_key` / `signal_prekeys_ready`
2. **Messaging gate** — `evaluateMessagingGate()` returns `bootstrap_failed` or `self_prekeys_not_ready` on Android only
3. **Session not persisted** — `SscSignalStore.persistSessions()` / `apply()` vs `commit()` timing on Samsung low-end devices
4. **Device wrap key loss** — JWT cannot be restored after restart → 401 on `/auth/me`
5. **Asymmetric Signal sessions** — inbound decrypt establishes session; outbound encrypt uses stale or missing session record
6. **Sealed sender path** — `sealedSender.js` fails; fallback encrypt also fails silently

## Local debug tooling (no production creds required)

Scripts under `scripts/debug/` (maintainer-added):

- `api-encryption-probe.mjs` — API + prekey status
- `libsignal-store-probe.mjs` — native store inspection patterns
- `settings-encryption-probe.cjs` — desktop encryption diagnostics
- `collect-full-diagnostics.ps1` — bundles logs

Run backend tests: `cd backend && pytest tests/test_pqxdh_policy.py tests/test_sealed_sender.py -q`

Run frontend gate tests: `cd frontend && yarn test messagingGate --watchAll=false`

## Acceptance criteria for a fix PR

- [ ] Android user with completed setup can **send** 1:1 Signal text to Windows peer
- [ ] Message persists in MongoDB (`messages` collection)
- [ ] Inbound decrypt shows stable plaintext (no flash → error)
- [ ] App restart keeps Google session (no *Not authenticated* on `/auth/me`)
- [ ] Test or documented manual QA steps in PR description

## AGPL / libsignal

Android APK combines `org.signal:libsignal-android` via `SscLibsignalPlugin` — see `THIRD_PARTY_NOTICES.md` and `memory/AGPL_COMPLIANCE.md`.