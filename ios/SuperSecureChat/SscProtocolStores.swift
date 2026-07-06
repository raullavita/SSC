import Foundation
import LibSignalClient

final class SscProtocolStores {
    let sessionStore: SscSessionStore
    let identityStore: SscIdentityStore
    let preKeyStore: SscPreKeyStore
    let signedPreKeyStore: SscSignedPreKeyStore
    let kyberPreKeyStore: SscKyberPreKeyStore

    init(root: URL, meta: SscSessionMeta) throws {
        sessionStore = try SscSessionStore(file: root.appendingPathComponent("sessions.json"))
        identityStore = try SscIdentityStore(root: root, meta: meta)
        preKeyStore = try SscPreKeyStore(file: root.appendingPathComponent("prekeys.json"))
        signedPreKeyStore = try SscSignedPreKeyStore(file: root.appendingPathComponent("signed_prekeys.json"))
        kyberPreKeyStore = try SscKyberPreKeyStore(file: root.appendingPathComponent("kyber_prekeys.json"))
    }
}

final class SscJsonStore {
    private let file: URL
    private(set) var data: [String: String]

    init(file: URL) throws {
        self.file = file
        let raw = try SscSecureStore.readText(from: file)
        if raw.isEmpty {
            data = [:]
        } else if let json = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: String] {
            data = json
        } else {
            data = [:]
        }
    }

    func save() throws {
        let encoded = try JSONSerialization.data(withJSONObject: data)
        try SscSecureStore.writeText(String(data: encoded, encoding: .utf8) ?? "{}", to: file)
    }
}

// Store implementations delegate to LibSignalClient InMemory-style JSON persistence.
// Production builds link libsignal-swift via SPM (see ios/README.md).

final class SscSessionStore: SessionStore {
    private let backing: SscJsonStore
    init(file: URL) throws { backing = try SscJsonStore(file: file) }
    func loadSession(for address: ProtocolAddress, context: StoreContext) throws -> SessionRecord? {
        guard let raw = backing.data[address.description], let bytes = Data(base64Encoded: raw) else { return nil }
        return try SessionRecord(bytes: bytes)
    }
    func storeSession(_ record: SessionRecord, for address: ProtocolAddress, context: StoreContext) throws {
        backing.data[address.description] = record.serialize().base64EncodedString()
        try backing.save()
    }
    func loadExistingSessions(for addresses: [ProtocolAddress], context: StoreContext) throws -> [SessionRecord] {
        try addresses.compactMap { try loadSession(for: $0, context: context) }
    }
}

final class SscIdentityStore: IdentityKeyStore {
    private let identityFile: URL
    private let trustedFile: URL
    private var meta: SscSessionMeta
    private var pair: IdentityKeyPair?
    private var trusted: [String: String] = [:]

    init(root: URL, meta: SscSessionMeta) throws {
        identityFile = root.appendingPathComponent("identity.json")
        trustedFile = root.appendingPathComponent("trusted.json")
        self.meta = meta
        let trustedRaw = try SscSecureStore.readText(from: trustedFile)
        if !trustedRaw.isEmpty,
           let json = try JSONSerialization.jsonObject(with: Data(trustedRaw.utf8)) as? [String: String] {
            trusted = json
        }
    }

    func identityKeyPair(context: StoreContext) throws -> IdentityKeyPair {
        if let pair { return pair }
        let raw = try SscSecureStore.readText(from: identityFile)
        if !raw.isEmpty,
           let doc = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
           let keyB64 = doc["identityKeyPair"] as? String,
           let bytes = Data(base64Encoded: keyB64) {
            pair = try IdentityKeyPair(bytes: bytes)
            if let reg = doc["registrationId"] as? UInt32 { meta.registrationId = reg }
            if let deviceId = doc["deviceId"] as? String { meta.deviceId = deviceId }
            if let localUserId = doc["localUserId"] as? String { meta.localUserId = localUserId }
            return pair!
        }
        let generated = IdentityKeyPair.generate()
        meta.registrationId = UInt32.random(in: 1...16380)
        pair = generated
        let doc: [String: Any] = [
            "identityKeyPair": generated.serialize().base64EncodedString(),
            "registrationId": meta.registrationId,
            "deviceId": meta.deviceId,
            "localUserId": meta.localUserId as Any,
        ]
        let encoded = try JSONSerialization.data(withJSONObject: doc)
        try SscSecureStore.writeText(String(data: encoded, encoding: .utf8) ?? "{}", to: identityFile)
        return generated
    }

    func localRegistrationId(context: StoreContext) throws -> UInt32 {
        _ = try identityKeyPair(context: context)
        return meta.registrationId
    }

    func saveIdentity(_ identity: IdentityKey, for address: ProtocolAddress, context: StoreContext) throws -> IdentityChange {
        let prev = trusted[address.description]
        trusted[address.description] = identity.serialize().base64EncodedString()
        let encoded = try JSONSerialization.data(withJSONObject: trusted)
        try SscSecureStore.writeText(String(data: encoded, encoding: .utf8) ?? "{}", to: trustedFile)
        return prev == nil ? .newOrUnchanged : .replacedExisting
    }

    func isTrustedIdentity(_ identity: IdentityKey, for address: ProtocolAddress, direction: Direction, context: StoreContext) throws -> Bool {
        guard let prev = trusted[address.description] else { return true }
        return prev == identity.serialize().base64EncodedString()
    }

    func identity(for address: ProtocolAddress, context: StoreContext) throws -> IdentityKey? {
        guard let raw = trusted[address.description], let bytes = Data(base64Encoded: raw) else { return nil }
        return try IdentityKey(bytes: bytes)
    }
}

final class SscPreKeyStore: PreKeyStore {
    private let backing: SscJsonStore
    init(file: URL) throws { backing = try SscJsonStore(file: file) }
    func loadPreKey(id: UInt32, context: StoreContext) throws -> PreKeyRecord {
        guard let raw = backing.data[String(id)], let bytes = Data(base64Encoded: raw) else {
            throw SignalError.invalidKeyIdentifier("prekey_missing")
        }
        return try PreKeyRecord(bytes: bytes)
    }
    func storePreKey(_ record: PreKeyRecord, id: UInt32, context: StoreContext) throws {
        backing.data[String(id)] = record.serialize().base64EncodedString()
        try backing.save()
    }
    func removePreKey(id: UInt32, context: StoreContext) throws {
        backing.data.removeValue(forKey: String(id))
        try backing.save()
    }
}

final class SscSignedPreKeyStore: SignedPreKeyStore {
    private let backing: SscJsonStore
    init(file: URL) throws { backing = try SscJsonStore(file: file) }
    func loadSignedPreKey(id: UInt32, context: StoreContext) throws -> SignedPreKeyRecord {
        guard let raw = backing.data[String(id)], let bytes = Data(base64Encoded: raw) else {
            throw SignalError.invalidKeyIdentifier("signed_prekey_missing")
        }
        return try SignedPreKeyRecord(bytes: bytes)
    }
    func storeSignedPreKey(_ record: SignedPreKeyRecord, id: UInt32, context: StoreContext) throws {
        backing.data[String(id)] = record.serialize().base64EncodedString()
        try backing.save()
    }
    func loadSignedPreKeys(context: StoreContext) throws -> [SignedPreKeyRecord] {
        try backing.data.keys.compactMap { key in
            guard let raw = backing.data[key], let bytes = Data(base64Encoded: raw) else { return nil }
            return try SignedPreKeyRecord(bytes: bytes)
        }
    }
}

final class SscKyberPreKeyStore: KyberPreKeyStore {
    private let backing: SscJsonStore
    init(file: URL) throws { backing = try SscJsonStore(file: file) }
    func loadKyberPreKey(id: UInt32, context: StoreContext) throws -> KyberPreKeyRecord {
        guard let raw = backing.data[String(id)], let bytes = Data(base64Encoded: raw) else {
            throw SignalError.invalidKeyIdentifier("kyber_prekey_missing")
        }
        return try KyberPreKeyRecord(bytes: bytes)
    }
    func storeKyberPreKey(_ record: KyberPreKeyRecord, id: UInt32, context: StoreContext) throws {
        backing.data[String(id)] = record.serialize().base64EncodedString()
        try backing.save()
    }
    func loadKyberPreKeys(context: StoreContext) throws -> [KyberPreKeyRecord] {
        try backing.data.keys.compactMap { key in
            guard let raw = backing.data[key], let bytes = Data(base64Encoded: raw) else { return nil }
            return try KyberPreKeyRecord(bytes: bytes)
        }
    }
    func markKyberPreKeyUsed(id: UInt32, signedPreKeyId: UInt32, baseKey: KEMPublicKey, context: StoreContext) throws {}
}

enum SscPreKeyBundleParser {
    static func parse(_ bundle: [String: Any]) throws -> PreKeyBundle {
        throw NSError(domain: "ssc", code: 10, userInfo: [NSLocalizedDescriptionKey: "bundle_parser_todo"])
    }
}