# SSC iOS — native SwiftUI

**Architecture (locked):** Pure native UI. **No WKWebView** for messenger.

See `memory/NATIVE_CLIENT_CHARTER.md`.

## Stack

| Layer | Tech |
|-------|------|
| UI | **SwiftUI** (`ContentView`, login, chat list, thread) |
| API | `SscApiClient` (URLSession + Bearer + `X-SSC-Client: ios/0.4.0/15`) |
| Session | `SscSessionStore` (UserDefaults; move to Keychain for production tokens) |
| Crypto | `LibsignalSession` / libsignal-swift (wire encrypt in next milestone) |

## Status

- Scaffold replaces WebView product path
- Login + conversation list + send shell compile as Swift sources
- Full libsignal send/receive, push (APNs), calls — continue on Mac with Xcode

## Build

```bash
# Create Xcode project if missing, add sources under SuperSecureChat/
# Add LibSignalClient SPM: https://github.com/signalapp/libsignal (0.96.4)
./scripts/build_ios.sh
```

Requires **macOS + Xcode** for real builds/installs.  
If you do not own a Mac yet, leave iOS sources in the repo and develop Android + Windows first.

## Removed product goal

- WKWebView loading React (`MainViewController` WebView shell is legacy — do not extend)

## Free path note

Apple Developer Program is **not** required until you want device install / TestFlight / App Store. Source can advance without paying.
