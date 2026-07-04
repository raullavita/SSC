# SSC Metadata Minimization Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 4 — Metadata Minimization

## Principles

1. **Push notifications** contain no message content, sender name, or email — only generic `"New message"`.
2. **Last-seen** is opt-in (`privacy_settings.last_seen_visible`, default `false`) and coarse-grained (`online` / `recently` / `away` / `hidden`).
3. **Conversation list API** returns `peer_id` only — never full `participants` arrays or peer emails.
4. **Auth `/me` and session responses** return `id` + `display_name` only — never `email`.
5. **WebSocket fanout** uses scrubbed payloads — no `participants` arrays on conversation topics.
6. **Sealed sender** is on by default (client opt-out via Settings).
7. **Service worker** (`frontend/public/sw.js`) validates `event.origin` before showing notifications.

## Modules

| Module | Purpose |
|--------|---------|
| `backend/core/metadata_policy.py` | Forbidden response fields + public DTO builders |
| `backend/core/last_seen.py` | Activity buckets + privacy map |
| `backend/core/push_payload.py` | `build_generic_push()` |
| `backend/core/conversation_meta.py` | Pin/mute/unread per user |
| `backend/push.py` | FCM dispatch using generic payload only |
| `frontend/src/lib/presence.js` | Heartbeat + presence formatting |

## API surfaces

- `POST /api/presence/heartbeat` — updates `last_active` (no precise timestamp exposed to peers by default)
- `GET /api/presence/users/{id}` — coarse bucket only
- `GET/PATCH /api/privacy` — opt-in visibility
- `POST /api/push/register` — device token storage
- `PATCH /api/conversations/{id}/meta` — pin/mute

## Gate

Engine 4 completes when `backend/scripts/run_engine4_gate.py` passes, including **step 4.7** `metadata_proof.py`.