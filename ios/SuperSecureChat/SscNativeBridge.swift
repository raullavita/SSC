import WebKit

enum SscNativeBridge {
    static func handle(method: String, callbackId: String, payload: String, webView: WKWebView) {
        // Crypto bridge stub — wire libsignal-swift in production builds.
        let response = "{\"ok\":false,\"detail\":\"ios_crypto_stub\"}"
        let script = "window.__sscBridge && window.__sscBridge._callback('\(callbackId)', false, '\(response)');"
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}