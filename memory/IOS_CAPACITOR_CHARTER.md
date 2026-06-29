# iOS Capacitor charter

**Version:** 1.0  
**Effective:** 2026-06-24  
**App ID:** `chat.ssc.secure`

---

## 1. Status

| Item | Status |
|------|--------|
| Capacitor iOS project (`frontend/ios/`) | ✅ Scaffolded |
| Xcode build on Windows | ❌ Not possible — requires macOS |
| Apple Developer Program | ⬜ $99/yr — required for device + App Store |
| APNs push (direct) | ⬜ Deferred — needs Apple certs |

---

## 2. Founder workflow (when Mac available)

```bash
cd frontend
yarn build:firebase          # or build:phone for LAN
yarn cap:sync
yarn cap:ios                 # opens Xcode
```

1. Enroll at [developer.apple.com](https://developer.apple.com) ($99/yr)
2. Configure signing team in Xcode
3. Add `GoogleService-Info.plist` for Firebase (if using FCM on iOS)
4. Test on physical iPhone (Web Crypto + HTTPS production API)

---

## 3. Parity with Android APK

| Feature | Android | iOS target |
|---------|---------|------------|
| Production API URL | ✅ baked in build | Same via `build:firebase` |
| Signal Protocol | ✅ libsignal Android | ⬜ libsignal iOS bindings (Engine 8+) |
| ML Kit translate | ✅ | ⬜ Apple on-device APIs later |
| FCM push | ✅ | ⬜ APNs via Capacitor push plugin |

---

## 4. Gate

iOS scaffold is **complete** when `frontend/ios/` exists and `cap add ios` succeeds.

**Q.63 listing prep (repo):** `app-store/`, `scripts/APP_STORE_SETUP.txt`, `SSC-BUILD-IOS.sh`, Info.plist usage strings. Founder still needs Mac + Apple Developer + App Store Connect upload.