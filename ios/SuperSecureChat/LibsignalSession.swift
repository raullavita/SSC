import Foundation
import LibSignalClient

final class LibsignalSession {
    private let root: URL
    private var signedPreKeyId = 1
    private var kyberPreKeyId = 1
    private var nextPreKeyId = 1
    private var meta = SscSessionMeta()

    private lazy var stores: SscProtocolStores = {
        try! SscProtocolStores(root: root, meta: meta)
    }()

    init(filesDir: URL) throws {
        root = filesDir.appendingPathComponent("ssc-signal", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    func configure(_ opts: [String: Any]) throws {
        if let deviceId = opts["deviceId"] as? String, !deviceId.isEmpty {
            meta.deviceId = deviceId
        }
        if let localUserId = opts["localUserId"] as? String {
            meta.localUserId = localUserId
        }
    }

    private func localAddress() throws -> ProtocolAddress {
        let userId = meta.localUserId ?? "ssc-local"
        return try ProtocolAddress(name: userId, deviceId: UInt32(meta.deviceId) ?? 1)
    }

    private func peerAddress(_ peerId: String, deviceId: String) throws -> ProtocolAddress {
        try ProtocolAddress(name: peerId, deviceId: UInt32(deviceId) ?? 1)
    }

    func generatePreKeyBundle() throws -> [String: Any] {
        let identity = try stores.identityStore.identityKeyPair(context: NullContext())
        let registrationId = try stores.identityStore.localRegistrationId(context: NullContext())
        let signedId = signedPreKeyId
        signedPreKeyId += 1
        let signed = try stores.signedPreKeyStore.generateSignedPreKey(id: signedId, identity: identity, context: NullContext())
        try stores.signedPreKeyStore.storeSignedPreKey(signed, id: signedId, context: NullContext())

        let preKeyId = nextPreKeyId
        nextPreKeyId += 1
        let preKey = try stores.preKeyStore.generatePreKey(id: preKeyId, context: NullContext())
        try stores.preKeyStore.storePreKey(preKey, id: preKeyId, context: NullContext())

        let kyberId = kyberPreKeyId
        kyberPreKeyId += 1
        let kyber = try stores.kyberPreKeyStore.generateKyberPreKey(id: kyberId, identity: identity, context: NullContext())
        try stores.kyberPreKeyStore.storeKyberPreKey(kyber, id: kyberId, context: NullContext())

        return [
            "registrationId": registrationId,
            "identityKey": identity.publicKey.serialize().base64EncodedString(),
            "signedPreKey": [
                "keyId": signedId,
                "publicKey": signed.publicKey().serialize().base64EncodedString(),
                "signature": signed.signature().base64EncodedString(),
            ],
            "preKeys": [[
                "keyId": preKeyId,
                "publicKey": preKey.publicKey().serialize().base64EncodedString(),
            ]],
            "kyberPreKey": [
                "keyId": kyberId,
                "publicKey": kyber.publicKey().serialize().base64EncodedString(),
                "signature": kyber.signature().base64EncodedString(),
            ],
        ]
    }

    func establishSession(peerId: String, deviceId: String, bundle: [String: Any]) throws -> [String: Any] {
        let remote = try peerAddress(peerId, deviceId: deviceId)
        let preKeyBundle = try SscPreKeyBundleParser.parse(bundle)
        let local = try localAddress()
        try processPreKeyBundle(
            preKeyBundle,
            for: remote,
            sessionStore: stores.sessionStore,
            identityStore: stores.identityStore,
            context: NullContext()
        )
        _ = local
        return ["ok": true]
    }

    func encryptMessage(plaintext: String, peerId: String, deviceId: String) throws -> [String: Any] {
        let remote = try peerAddress(peerId, deviceId: deviceId)
        let cipher = try SessionCipher(
            sessionStore: stores.sessionStore,
            preKeyStore: stores.preKeyStore,
            signedPreKeyStore: stores.signedPreKeyStore,
            kyberPreKeyStore: stores.kyberPreKeyStore,
            identityStore: stores.identityStore,
            recipientId: remote,
            deviceId: UInt32(deviceId) ?? 1,
            context: NullContext()
        )
        let ciphertext = try cipher.encrypt(Data(plaintext.utf8))
        return [
            "ciphertext": ciphertext.serialize().base64EncodedString(),
            "messageType": ciphertext.messageType.rawValue,
        ]
    }

    func decryptMessage(ciphertext: String, peerId: String, deviceId: String) throws -> String {
        let remote = try peerAddress(peerId, deviceId: deviceId)
        let cipher = try SessionCipher(
            sessionStore: stores.sessionStore,
            preKeyStore: stores.preKeyStore,
            signedPreKeyStore: stores.signedPreKeyStore,
            kyberPreKeyStore: stores.kyberPreKeyStore,
            identityStore: stores.identityStore,
            recipientId: remote,
            deviceId: UInt32(deviceId) ?? 1,
            context: NullContext()
        )
        let bytes = try Data(base64Encoded: ciphertext) ?? Data()
        let plaintext = try cipher.decrypt(bytes)
        return String(data: plaintext, encoding: .utf8) ?? ""
    }
}

struct SscSessionMeta {
    var registrationId: UInt32 = 0
    var deviceId: String = "1"
    var localUserId: String?
}

private extension UInt32 {
    init?(_ string: String) {
        guard let value = UInt32(string) else { return nil }
        self = value
    }
}

