import UIKit

/// Legacy WebView shell entry — **not** product path (NATIVE_CLIENT_CHARTER).
/// Product entry is SwiftUI `SscApp` (`@main`). This file is kept for reference only
/// and must not declare `@main` (would conflict with SscApp).
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Do not install WKWebView shell. Use SscApp / ContentView.
        return true
    }
}
