# SSC Metadata Minimization Charter

**Version:** 1.0  
**Effective:** 2026-07-04  
**Engine:** 4 — Metadata Minimization

## Principles

1. Push notifications contain no message content or sender identity beyond "New message".
2. Last-seen is opt-in and coarse-grained.
3. Conversation metadata stores only what the UI requires.
4. Service worker (`frontend/public/sw.js`) validates origin before handling push events.

*Implementation begins in Engine 4 (Phase 2).*