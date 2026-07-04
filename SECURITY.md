# Security Policy

## Reporting a vulnerability

**Do not** open public GitHub issues with exploit details.

Email **contact@supersecurechat.com** with:

- Description of the issue
- Steps to reproduce
- Impact assessment (if known)

We aim to respond within 7 days.

## Scope

- `api.supersecurechat.com` (Cloud Run API)
- Installed Android and Windows clients
- E2E encryption, session handling, retention/TTL, panic wipe

The public website (`www.supersecurechat.com`) is informational only — no web chat.

## Design principles

- Server stores **ciphertext only** for messages and files
- **No inside AI** on message content
- Push notifications are **generic** (no message body)
- Installed-client enforcement in production
- 24h default retention with TTL indexes; panic wipe clears user data immediately

Full charters: `memory/SECURITY_MODEL.md`, `memory/RETENTION_CHARTER.md`, `memory/SIGNAL_CHARTER.md`.