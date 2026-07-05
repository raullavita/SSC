import UIKit
import WebKit

final class MainViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    private let refreshControl = UIRefreshControl()
    private let offlineBanner = UILabel()
    private var baseURL = ProcessInfo.processInfo.environment["SSC_WEB_URL"] ?? "https://www.supersecurechat.com"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.08, blue: 0.10, alpha: 1)
        configureWebView()
        configureOfflineBanner()
        loadHome()
    }

    private func configureWebView() {
        let config = webView.configuration
        config.preferences.javaScriptEnabled = true
        config.allowsInlineMediaPlayback = true
        config.userContentController.add(self, name: "sscBridge")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        refreshControl.addTarget(self, action: #selector(reloadHome), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
    }

    private func configureOfflineBanner() {
        offlineBanner.text = "Offline — pull to retry"
        offlineBanner.textAlignment = .center
        offlineBanner.textColor = .white
        offlineBanner.backgroundColor = UIColor(red: 0.9, green: 0.2, blue: 0.2, alpha: 0.9)
        offlineBanner.isHidden = true
        offlineBanner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(offlineBanner)
        NSLayoutConstraint.activate([
            offlineBanner.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            offlineBanner.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineBanner.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            offlineBanner.heightAnchor.constraint(equalToConstant: 36),
        ])
    }

    @objc private func reloadHome() {
        webView.reload()
    }

    func loadHome() {
        guard let url = URL(string: baseURL) else { return }
        webView.load(URLRequest(url: url))
    }

    func openDeepLink(_ url: URL) {
        if let webPath = SscDeepLink.webPath(for: url) {
            baseURL = (ProcessInfo.processInfo.environment["SSC_WEB_URL"] ?? "https://www.supersecurechat.com")
                + webPath
            loadHome()
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        let script = """
        window.__SSC_IOS_CLIENT='ios/0.3.0/3';
        window.__SSC_IOS_SHELL='1';
        window.__SSC_IOS_FEATURES='splash_screen,deep_links,pull_to_refresh,offline_retry,file_chooser,edge_to_edge';
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()
        offlineBanner.isHidden = true
        if let bridge = Bundle.main.path(forResource: "ssc_crypto_bridge", ofType: "js"),
           let source = try? String(contentsOfFile: bridge) {
            webView.evaluateJavaScript(source, completionHandler: nil)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        refreshControl.endRefreshing()
        offlineBanner.isHidden = false
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url,
           ApiClient.shouldAttachClientHeader(url: url) {
            var request = navigationAction.request
            request.setValue(ApiClient.clientHeaderValue, forHTTPHeaderField: ApiClient.clientHeaderName)
            webView.load(request)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "sscBridge",
              let body = message.body as? [String: Any],
              let method = body["method"] as? String,
              let callbackId = body["id"] as? String else { return }
        SscNativeBridge.handle(method: method, callbackId: callbackId, payload: body["payload"] as? String ?? "{}", webView: webView)
    }
}