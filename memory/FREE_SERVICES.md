# SSC — Free services guide

**Updated:** 2026-06-23  
**Desktop copy:** `SSC-FREE-SERVICES.md`

## Google OAuth — FREE

Google Cloud Console → OAuth 2.0 Client ID → `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env`. No card required for OAuth alone. See `SSC-GOOGLE-OAUTH-SETUP.txt` on Desktop.

## Translation — FREE options

| Provider | Setup |
|----------|-------|
| **MyMemory** (default) | `TRANSLATION_ENABLED=true` — no API key |
| **Google Translate** | `TRANSLATION_PROVIDER=google` + `GOOGLE_TRANSLATE_API_KEY` ($300 GCP trial) |

**Warning:** sends decrypted text to third party.

## Double Ratchet — FREE, Engine 8

libsignal is open source. Major engineering effort — not a paid API.

## HTTPS

Custom domain ~$10–15/yr OR free Railway/Fly subdomain until domain is ready.