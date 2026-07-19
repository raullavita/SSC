import Foundation
import Combine

struct SscConversation: Identifiable, Sendable {
    let id: String
    let title: String
    let peerId: String?
    let type: String
}

struct SscMessage: Identifiable, Sendable {
    let id: String
    let senderId: String?
    let plaintext: String?
    let ciphertext: String?
}

/// Native HTTP client — replaces WebView networking for messenger.
@MainActor
final class SscApiClient: ObservableObject {
    private let session: SscSessionStore
    private let baseURL: String
    private let clientIdentity = "ios/0.4.0/15"
    private var crypto: LibsignalSession?

    init(session: SscSessionStore, apiBase: String = "https://api.supersecurechat.com") {
        self.session = session
        self.baseURL = apiBase.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            crypto = try? LibsignalSession(filesDir: docs)
        }
    }

    func login(email: String, password: String) async throws {
        let body: [String: Any] = ["email": email, "password": password]
        let json = try await request(path: "/api/auth/login", method: "POST", body: body)
        guard let token = json["ws_token"] as? String,
              let user = json["user"] as? [String: Any],
              let id = user["id"] as? String else {
            throw URLError(.userAuthenticationRequired)
        }
        session.saveSession(
            token: token,
            userId: id,
            displayName: user["display_name"] as? String,
            username: user["username"] as? String
        )
        try? crypto?.configure([
            "localUserId": id,
            "deviceId": session.deviceId,
        ])
        try? await uploadPrekeys()
    }

    func logout() async {
        _ = try? await request(path: "/api/auth/logout", method: "POST", body: [:])
        session.clear()
    }

    func listConversations() async throws -> [SscConversation] {
        let json = try await request(path: "/api/conversations", method: "GET", body: nil)
        let arr = json["conversations"] as? [[String: Any]] ?? []
        return arr.map { c in
            let id = (c["id"] as? String) ?? (c["_id"] as? String) ?? UUID().uuidString
            let peer = c["peer_id"] as? String
            return SscConversation(
                id: id,
                title: peer ?? id,
                peerId: peer,
                type: (c["type"] as? String) ?? "direct"
            )
        }
    }

    func listMessages(conversationId: String) async throws -> [SscMessage] {
        let json = try await request(
            path: "/api/conversations/\(conversationId)/messages",
            method: "GET",
            body: nil
        )
        let arr = json["messages"] as? [[String: Any]] ?? []
        return arr.map { m in
            let ct = m["ciphertext"] as? String
            let sender = m["sender_id"] as? String
            var plain: String? = nil
            if let ct, let sender, let crypto {
                plain = try? crypto.decryptMessage(ciphertext: ct, peerId: sender, deviceId: "1")
            }
            return SscMessage(
                id: (m["id"] as? String) ?? UUID().uuidString,
                senderId: sender,
                plaintext: plain ?? (ct != nil ? "[encrypted]" : nil),
                ciphertext: ct
            )
        }
    }

    func sendPlaintext(conversationId: String, peerId: String, text: String) async throws {
        guard let crypto else { throw URLError(.cannotLoadFromNetwork) }
        try crypto.configure([
            "localUserId": session.userId ?? "",
            "deviceId": session.deviceId,
        ])
        // Establish session via prekey bundle
        let bundleJson = try await request(
            path: "/api/prekeys/users/\(peerId)/devices/1",
            method: "GET",
            body: nil
        )
        let bundle = (bundleJson["bundle"] as? [String: Any]) ?? bundleJson
        _ = try crypto.establishSession(peerId: peerId, deviceId: "1", bundle: bundle)
        let enc = try crypto.encryptMessage(plaintext: text, peerId: peerId, deviceId: "1")
        guard let ct = enc["ciphertext"] as? String else {
            throw URLError(.cannotParseResponse)
        }
        let body: [String: Any] = [
            "ciphertext": ct,
            "protocol": "signal_v1",
            "device_ciphertexts": ["1": ct],
        ]
        _ = try await request(
            path: "/api/conversations/\(conversationId)/messages",
            method: "POST",
            body: body
        )
    }

    private func uploadPrekeys() async throws {
        guard let crypto, let userId = session.userId else { return }
        try crypto.configure(["localUserId": userId, "deviceId": session.deviceId])
        let bundle = try crypto.generatePreKeyBundle()
        var payload = bundle
        // Map camelCase to server snake_case
        let signed = bundle["signedPreKey"] as? [String: Any] ?? [:]
        let preKeys = bundle["preKeys"] as? [[String: Any]] ?? []
        let kyber = bundle["kyberPreKey"] as? [String: Any]
        var body: [String: Any] = [
            "device_id": session.deviceId,
            "registration_id": bundle["registrationId"] as? UInt32 ?? 1,
            "identity_key": bundle["identityKey"] as? String ?? "",
            "signed_prekey": [
                "key_id": signed["keyId"] as? Int ?? 1,
                "public_key": signed["publicKey"] as? String ?? "",
                "signature": signed["signature"] as? String ?? "",
            ],
            "prekeys": preKeys.map { pk in
                [
                    "key_id": pk["keyId"] as? Int ?? 0,
                    "public_key": pk["publicKey"] as? String ?? "",
                ] as [String: Any]
            },
        ]
        if let kyber {
            body["kyber_prekey"] = [
                "key_id": kyber["keyId"] as? Int ?? 1,
                "public_key": kyber["publicKey"] as? String ?? "",
                "signature": kyber["signature"] as? String ?? "",
            ]
        }
        _ = try await request(path: "/api/prekeys/bundle", method: "PUT", body: body)
        _ = try? await request(
            path: "/api/devices",
            method: "POST",
            body: [
                "device_id": session.deviceId,
                "name": "iPhone",
                "platform": "ios",
            ]
        )
    }

    private func request(path: String, method: String, body: [String: Any]?) async throws -> [String: Any] {
        let full = URL(string: baseURL + path)!
        var req = URLRequest(url: full)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue(clientIdentity, forHTTPHeaderField: "X-SSC-Client")
        req.setValue("v1", forHTTPHeaderField: "X-SSC-Native-Bridge")
        req.setValue(session.deviceId, forHTTPHeaderField: "X-SSC-Device-Id")
        if let token = session.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if !(200...299).contains(http.statusCode) {
            let detail = obj["detail"] as? String ?? "HTTP \(http.statusCode)"
            throw NSError(domain: "SSC", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: detail])
        }
        return obj
    }
}
