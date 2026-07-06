import Foundation
import LibSignalClient

final class SscCryptoService {
    static let shared = SscCryptoService()

    private var session: LibsignalSession?
    private var filesDir: URL?

    func bind(filesDir: URL) {
        self.filesDir = filesDir
    }

    private func libsignal() throws -> LibsignalSession {
        guard let dir = filesDir else { throw NSError(domain: "ssc", code: 1, userInfo: [NSLocalizedDescriptionKey: "ssc_crypto_not_bound"]) }
        if let session { return session }
        let created = try LibsignalSession(filesDir: dir)
        session = created
        return created
    }

    func dispatch(method: String, args: [String: Any]) throws -> Any {
        switch method {
        case "available":
            return ["ok": true]
        case "configure":
            try libsignal().configure(args)
            return ["ok": true]
        case "generatePreKeyBundle":
            return try libsignal().generatePreKeyBundle()
        case "establishSession":
            guard let peerId = args["peerId"] as? String,
                  let bundle = args["bundle"] as? [String: Any] else {
                throw NSError(domain: "ssc", code: 2)
            }
            let deviceId = (args["deviceId"] as? String) ?? "1"
            return try libsignal().establishSession(peerId: peerId, deviceId: deviceId, bundle: bundle)
        case "encryptMessage":
            guard let plaintext = args["plaintext"] as? String,
                  let peerId = args["peerId"] as? String else {
                throw NSError(domain: "ssc", code: 3)
            }
            let deviceId = (args["deviceId"] as? String) ?? "1"
            return try libsignal().encryptMessage(plaintext: plaintext, peerId: peerId, deviceId: deviceId)
        case "decryptMessage":
            guard let ciphertext = args["ciphertext"] as? String,
                  let peerId = args["peerId"] as? String else {
                throw NSError(domain: "ssc", code: 4)
            }
            let deviceId = (args["deviceId"] as? String) ?? "1"
            return try libsignal().decryptMessage(ciphertext: ciphertext, peerId: peerId, deviceId: deviceId)
        case "wipeLocalData":
            if let dir = filesDir {
                let root = dir.appendingPathComponent("ssc-signal", isDirectory: true)
                try? FileManager.default.removeItem(at: root)
            }
            session = nil
            return ["ok": true]
        default:
            throw NSError(domain: "ssc", code: 404, userInfo: [NSLocalizedDescriptionKey: "ssc_crypto_method_unsupported"])
        }
    }
}