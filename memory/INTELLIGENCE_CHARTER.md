# SSC Intelligence Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 12 — Smart features + premium UX

## Privacy principle

All intelligence runs **on the client** or on **local services the user controls**. SSC servers never decrypt messages for smart features.

## OSS providers

| Feature | Library | Repo |
|---------|---------|------|
| Local search | minisearch | https://github.com/lucaong/minisearch |
| Language detect | franc | https://github.com/wooorm/franc |
| Translation | LibreTranslate (proxy) | https://github.com/LibreTranslate/LibreTranslate |
| Smart replies | Ollama (optional, local) | https://github.com/ollama/ollama |

## Server features (metadata-minimal)

- **Typing indicators:** ephemeral WebSocket only — no DB
- **Disappearing messages:** per-message `disappearing_seconds` → `expires_at`
- **Smart config:** `GET /api/smart/config` — feature flags + provider registry

## Client features

- Encrypted local message index + search
- Auto-translate incoming messages (franc + LibreTranslate)
- Smart reply chips (Ollama with rule-based fallback)
- Voice messages (MediaRecorder → E2EE file upload)
- Presence badges in conversation list

## Gate

Engine 12 completes when `backend/scripts/run_engine12_gate.py` passes step **12.12**.