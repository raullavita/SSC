# SSC Intelligence Charter

**Version:** 1.2  
**Effective:** 2026-07-17  
**Engine:** 12 + 13 — Premium UX

## Design rule

SSC does not run inference on message content. Optional translation is user-controlled and uses the SSC server proxy when enabled.

Allowed “smart” features use deterministic OSS only:

| Feature | Library | Repo |
|---------|---------|------|
| Local search | minisearch | https://github.com/lucaong/minisearch |
| Language detect | franc | https://github.com/wooorm/franc |
| Translation | LibreTranslate (server proxy) | https://github.com/LibreTranslate/LibreTranslate |

## Server features (metadata-minimal)

- **Typing indicators:** ephemeral WebSocket only — no DB
- **Disappearing messages:** per-message `disappearing_seconds` → `expires_at`
- **Translation config:** `GET /api/config` — `translation_enabled` when LibreTranslate is configured

## Client features

- Encrypted local message index + search
- Auto-translate incoming messages when server translation is enabled
- Voice messages (MediaRecorder → E2EE file upload)
- Presence badges in conversation list
- Safety numbers (libsignal Fingerprint)
- Encrypted reactions (`signal_v1_reaction`)
- Message threads (`reply_to`)

## Gate

Engine 12: `run_engine12_gate.py` step **12.12**  
Engine 13: `run_engine13_gate.py` step **13.10**
