# Starter issues (maintainer: paste into GitHub Issues)

After pushing `.github/` templates, create these from the repo **Issues → New issue** or copy titles/bodies below.

---

### 1. Document clean-clone Windows desktop build

**Labels:** `help wanted`, `good first issue`, `documentation`

**Body:**

```markdown
## Task
Write a short doc (or improve README) for building `SSC-Setup-*.exe` from a fresh `git clone` on Windows 10/11.

## Must cover
- Prerequisites: Node, Yarn, Python not required for desktop-only build
- Run `SSC-BUILD-DESKTOP-WIN.bat`
- What gitignored files are NOT needed for a contributor desktop build
- Expected output path

## Acceptance
- Another developer can follow the doc without asking the maintainer
```

---

### 2. Add frontend test for InstalledClientGate

**Labels:** `help wanted`, `good first issue`, `tests`

**Body:**

```markdown
## Task
Add/extend Jest tests ensuring browser (non-installed) users see the install-required screen, not chat.

## Files
- `frontend/src/components/InstalledClientGate.jsx`
- `frontend/src/lib/platform.js` (mock)

## Acceptance
- `yarn test:ci` passes
- Test fails if gate is accidentally removed
```

---

### 3. Review WebRTC signaling error path (M9)

**Labels:** `help wanted`, `security`, `webrtc`

**Body:**

```markdown
## Context
Backend sends `signaling-error` on WS validation failure; frontend shows toast in `useChatSocket.js`.

## Ask
- Review for missed cases (group calls, outbound offers)
- Suggest tests or hardening PRs

No production credentials needed — local docker + two test users is enough.
```