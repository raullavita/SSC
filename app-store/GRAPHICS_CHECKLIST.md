# App Store graphics checklist (Q.63)

Place finished assets under `app-store/store_graphics/`.

| Asset | Size | File name (suggested) | Status |
|-------|------|------------------------|--------|
| App icon | 1024×1024 PNG (no alpha) | `icon-1024.png` | [ ] |
| iPhone 6.7" screenshot 1 | 1290×2796 | `iphone67-01-chat.png` | [ ] |
| iPhone 6.7" screenshot 2 | 1290×2796 | `iphone67-02-security.png` | [ ] |
| iPhone 6.5" screenshot (optional) | 1284×2778 | `iphone65-01.png` | [ ] |
| iPad Pro 12.9" (optional) | 2048×2732 | `ipad-01.png` | [ ] |

**Tips**
- Capture from release build on device or Simulator (dark theme).
- No "official Signal app" implication — SSC is independent AGPL software.
- Founder runs `./scripts/prepare_app_store_listing.sh` on Mac to validate files.