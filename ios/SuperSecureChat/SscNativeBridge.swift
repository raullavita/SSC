import WebKit

enum SscNativeBridge {
    static func handle(method: String, callbackId: String, payload: String, webView: WKWebView) {
        do {
            let args = try JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [String: Any] ?? [:]
            let result = try SscCryptoService.shared.dispatch(method: method, args: args)
            deliver(callbackId: callbackId, ok: true, payload: result, webView: webView)
        } catch {
            deliver(callbackId: callbackId, ok: false, payload: error.localizedDescription, webView: webView)
        }
    }

    private static func deliver(callbackId: String, ok: Bool, payload: Any, webView: WKWebView) {
        let encoded: String
        if let dict = payload as? [String: Any],
           let data = try? JSONSerialization.data(withJSONObject: dict),
           let text = String(data: data, encoding: .utf8) {
            encoded = text
        } else if let text = payload as? String {
            encoded = "\"\(text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\""))\""
        } else {
            encoded = "\"ssc_crypto_error\""
        }
        let script = "window.__sscBridge && window.__sscBridge._callback('\(callbackId)', \(ok ? "true" : "false"), \(encoded));"
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
    }
}