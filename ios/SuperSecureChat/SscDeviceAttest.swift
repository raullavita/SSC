import CryptoKit
import Foundation

enum SscDeviceAttest {
    static let headerName = "X-SSC-Device-Attest"

    static func currentToken() -> String? {
        let secret = ProcessInfo.processInfo.environment["SSC_DEVICECHECK_SECRET"] ?? ""
        if secret.isEmpty {
            return "ssc-attest-test-v1"
        }
        let ts = Int(Date().timeIntervalSince1970)
        let message = "ios:\(ts)"
        let key = SymmetricKey(data: Data(secret.utf8))
        let sig = HMAC<SHA256>.authenticationCode(for: Data(message.utf8), using: key)
        let hex = sig.map { String(format: "%02x", $0) }.joined()
        return "\(ts).\(hex)"
    }
}