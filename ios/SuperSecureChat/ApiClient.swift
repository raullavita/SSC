import Foundation

enum ApiClient {
    static let clientHeaderName = "X-SSC-Client"
    static let nativeBridgeHeaderName = "X-SSC-Native-Bridge"
    static let nativeBridgeValue = "v1"
    static let clientHeaderValue = "ios/0.3.0/8"
    static let shellFeatures = "splash_screen,deep_links,pull_to_refresh,offline_retry,file_chooser,edge_to_edge"

    static func shouldAttachClientHeader(url: URL) -> Bool {
        url.absoluteString.contains("/api/")
    }

    static func attachHeaders(to request: inout URLRequest) {
        request.setValue(clientHeaderValue, forHTTPHeaderField: clientHeaderName)
        request.setValue(nativeBridgeValue, forHTTPHeaderField: nativeBridgeHeaderName)
        if let token = SscDeviceAttest.currentToken() {
            request.setValue(token, forHTTPHeaderField: SscDeviceAttest.headerName)
        }
    }
}