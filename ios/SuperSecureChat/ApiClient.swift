import Foundation

enum ApiClient {
    static let clientHeaderName = "X-SSC-Client"
    static let clientHeaderValue = "ios/0.3.0/3"
    static let shellFeatures = "splash_screen,deep_links,pull_to_refresh,offline_retry,file_chooser,edge_to_edge"

    static func shouldAttachClientHeader(url: URL) -> Bool {
        url.absoluteString.contains("/api/")
    }
}