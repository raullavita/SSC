import Foundation

enum SscDeepLink {
    static func webPath(for url: URL) -> String? {
        if url.scheme == "ssc" {
            let host = url.host ?? ""
            let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if host == "link-device" { return "/link-device" }
            if host == "add", !path.isEmpty { return "/add/\(path)" }
            return "/"
        }
        if url.host == "www.supersecurechat.com", url.path.hasPrefix("/add/") {
            return url.path
        }
        return nil
    }
}