import Foundation
import Security

enum SscSecureStore {
    private static let encPrefix = "SSCENC1:"
    private static let keychainService = "com.supersecurechat.app.signal"

    static func readText(from url: URL) throws -> String {
        guard FileManager.default.fileExists(atPath: url.path) else { return "" }
        let raw = try String(contentsOf: url, encoding: .utf8)
        if raw.hasPrefix(encPrefix) {
            let payload = Data(base64Encoded: String(raw.dropFirst(encPrefix.count))) ?? Data()
            let plain = try decrypt(payload)
            return String(data: plain, encoding: .utf8) ?? ""
        }
        return raw
    }

    static func writeText(_ plaintext: String, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encrypted = try encrypt(Data(plaintext.utf8))
        let encoded = encPrefix + encrypted.base64EncodedString()
        try encoded.write(to: url, atomically: true, encoding: .utf8)
    }

    private static func masterKey() throws -> Data {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "ssc_signal_master_v1",
            kSecReturnData as String: true,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data {
            return data
        }
        var newKey = Data(count: 32)
        let result = newKey.withUnsafeMutableBytes {
            SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!)
        }
        guard result == errSecSuccess else { throw NSError(domain: "SscSecureStore", code: 1) }
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "ssc_signal_master_v1",
            kSecValueData as String: newKey,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        SecItemAdd(add as CFDictionary, nil)
        return newKey
    }

    private static func encrypt(_ plaintext: Data) throws -> Data {
        let key = try masterKey()
        let nonce = try randomBytes(count: 12)
        var combined = nonce
        combined.append(xorCrypt(plaintext, key: key, nonce: nonce))
        return combined
    }

    private static func decrypt(_ payload: Data) throws -> Data {
        guard payload.count > 12 else { throw NSError(domain: "SscSecureStore", code: 2) }
        let key = try masterKey()
        let nonce = payload.prefix(12)
        let cipher = payload.suffix(from: 12)
        return xorCrypt(cipher, key: key, nonce: nonce)
    }

    private static func xorCrypt(_ input: Data, key: Data, nonce: Data) -> Data {
        var out = Data(count: input.count)
        for i in 0..<input.count {
            let kb = key[i % key.count]
            let nb = nonce[i % nonce.count]
            out[i] = input[i] ^ kb ^ nb
        }
        return out
    }

    private static func randomBytes(count: Int) throws -> Data {
        var data = Data(count: count)
        let result = data.withUnsafeMutableBytes {
            SecRandomCopyBytes(kSecRandomDefault, count, $0.baseAddress!)
        }
        guard result == errSecSuccess else { throw NSError(domain: "SscSecureStore", code: 3) }
        return data
    }
}