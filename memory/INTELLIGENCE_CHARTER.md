# SSC Intelligence Charter

**Version:** 1.1  
**Effective:** 2026-07-04  
**Engine:** 12 + 13 — Premium UX, **no inside AI**

## No inside AI (hard rule)

SSC does **not** ship inside AI: no Ollama, no smart replies, no on-device LLM, no server-side inference on message content.

Allowed “smart” features use deterministic OSS only:

| Feature | Library | Repo |
|---------|---------|------|
| Local search | minisearch | https://github.com/lucaong/minisearch |
| Language detect | franc | https://github.com/wooorm/franc |
| Translation | LibreTranslate (proxy) | https://github.com/LibreTranslate/LibreTranslate |

## Server features (metadata-minimal)

- **Typing indicators:** ephemeral WebSocket only — no DB
- **Disappearing messages:** per-message `disappearing_seconds` → `expires_at`
- **Smart config:** `GET /api/smart/config` — `no_inside_ai: true`

## Client features

- Encrypted local message index + search
- Auto-translate incoming messages (franc + LibreTranslate)
- Voice messages (MediaRecorder → E2EE file upload)
- Presence badges in conversation list
- Safety numbers (libsignal Fingerprint)
- Encrypted reactions (`signal_v1_reaction`)
- Message threads (`reply_to`)

## Gate

Engine 12: `run_engine12_gate.py` step **12.12**  
Engine 13: `run_engine13_gate.py` step **13.10**