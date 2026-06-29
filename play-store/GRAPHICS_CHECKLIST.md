# Play Store graphics checklist (Q.62)

Place finished assets under `play-store/store_graphics/` before upload.

| Asset | Size | File name (suggested) | Status |
|-------|------|------------------------|--------|
| App icon | 512×512 PNG | `icon-512.png` | [ ] |
| Feature graphic | 1024×500 PNG/JPG | `feature-1024x500.png` | [ ] |
| Phone screenshot 1 | min 1080×1920 | `phone-01-chat.png` | [ ] |
| Phone screenshot 2 | min 1080×1920 | `phone-02-security.png` | [ ] |
| Phone screenshot 3 (optional) | min 1080×1920 | `phone-03-calls.png` | [ ] |
| 7-inch tablet (optional) | 1200×1920 | `tablet-7-01.png` | [ ] |
| 10-inch tablet (optional) | 1600×2560 | `tablet-10-01.png` | [ ] |

**Tips**
- Use real in-app screenshots from a release build (dark theme matches brand).
- No misleading “Signal official” branding — SSC is independent open source.
- Show lock / encryption indicators where relevant.
- Founder runs `.\scripts\prepare_play_listing.ps1` to verify files exist.