package com.supersecurechat.app

import org.json.JSONArray
import org.json.JSONObject
import org.signal.libsignal.crypto.Aes256GcmSiv
import org.signal.libsignal.protocol.IdentityKey
import org.signal.libsignal.protocol.SessionBuilder
import org.signal.libsignal.protocol.SessionCipher
import org.signal.libsignal.protocol.SignalProtocolAddress
import org.signal.libsignal.protocol.ecc.ECKeyPair
import org.signal.libsignal.protocol.ecc.ECPublicKey
import org.signal.libsignal.protocol.fingerprint.NumericFingerprintGenerator
import org.signal.libsignal.protocol.kem.KEMKeyPair
import org.signal.libsignal.protocol.kem.KEMKeyType
import org.signal.libsignal.protocol.kem.KEMPublicKey
import org.signal.libsignal.protocol.message.CiphertextMessage
import org.signal.libsignal.protocol.message.PreKeySignalMessage
import org.signal.libsignal.protocol.message.SignalMessage
import org.signal.libsignal.protocol.state.KyberPreKeyRecord
import org.signal.libsignal.protocol.state.PreKeyBundle
import org.signal.libsignal.protocol.state.PreKeyRecord
import org.signal.libsignal.protocol.state.SignedPreKeyRecord
import java.io.File
import java.security.SecureRandom
import java.time.Instant

class LibsignalSession(filesDir: File) {
    private val root = File(filesDir, "ssc-signal")
    val meta = SscSessionMeta()
    private val sessionStore = SscSessionStore(SscFileJsonStore(File(root, "sessions.json")))
    private val identityStore = SscIdentityStore(root, meta)
    private val preKeysFile = SscFileJsonStore(File(root, "prekeys.json"))
    private val signedPreKeysFile = SscFileJsonStore(File(root, "signed_prekeys.json"))
    private val kyberPreKeysFile = SscFileJsonStore(File(root, "kyber_prekeys.json"))
    private val preKeyStore = SscPreKeyStore(preKeysFile)
    private val signedPreKeyStore = SscSignedPreKeyStore(signedPreKeysFile)
    private val kyberPreKeyStore = SscKyberPreKeyStore(kyberPreKeysFile)
    private val counterStore = SscFileJsonStore(File(root, "prekey_counters.json"))
    private val dekFile = File(root, "file_dek.json")
    private var signedPreKeyId = 1
    private var kyberPreKeyId = 1
    private var nextPreKeyId = 1

    init {
        loadPreKeyCounters()
    }

    private fun maxStoredId(store: SscFileJsonStore): Int {
        var max = 0
        val keys = store.data.keys()
        while (keys.hasNext()) {
            val id = keys.next().toIntOrNull() ?: continue
            if (id > max) max = id
        }
        return max
    }

    private fun loadPreKeyCounters() {
        val saved = counterStore.data
        signedPreKeyId = maxOf(saved.optInt("signedPreKeyId", 0), maxStoredId(signedPreKeysFile)) + 1
        kyberPreKeyId = maxOf(saved.optInt("kyberPreKeyId", 0), maxStoredId(kyberPreKeysFile)) + 1
        nextPreKeyId = maxOf(saved.optInt("nextPreKeyId", 0), maxStoredId(preKeysFile)) + 1
    }

    private fun savePreKeyCounters() {
        counterStore.data.put("signedPreKeyId", signedPreKeyId)
        counterStore.data.put("kyberPreKeyId", kyberPreKeyId)
        counterStore.data.put("nextPreKeyId", nextPreKeyId)
        counterStore.save()
    }

    private fun fileEncryptionKey(): ByteArray {
        if (dekFile.exists()) {
            val doc = JSONObject(SscSecureStore.readText(dekFile))
            return B64.decode(doc.getString("key"))
        }
        val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
        SscSecureStore.writeText(dekFile, JSONObject().put("key", B64.encode(key)).toString())
        return key
    }

    fun configure(opts: JSONObject) {
        opts.optString("deviceId", "").takeIf { it.isNotEmpty() }?.let { meta.deviceId = it }
        opts.optString("localUserId", "").takeIf { it.isNotEmpty() }?.let { meta.localUserId = it }
        if (opts.has("localUserId") && opts.isNull("localUserId")) {
            meta.localUserId = null
        }
    }

    private fun localAddress(): SignalProtocolAddress {
        val userId = meta.localUserId ?: "ssc-local"
        return SignalProtocolAddress(userId, meta.deviceId.toIntOrNull() ?: 1)
    }

    private fun peerAddress(peerId: String, deviceId: String = "1"): SignalProtocolAddress {
        return SignalProtocolAddress(peerId, deviceId.toIntOrNull() ?: 1)
    }

    private fun sessionCipher(peerId: String, deviceId: String): SessionCipher {
        return SessionCipher(
            sessionStore,
            preKeyStore,
            signedPreKeyStore,
            kyberPreKeyStore,
            identityStore,
            peerAddress(peerId, deviceId),
            localAddress(),
        )
    }

    fun generatePreKeyBundle(): JSONObject {
        val identity = identityStore.identityKeyPair
        val registrationId = identityStore.localRegistrationId
        val deviceId = meta.deviceId.toIntOrNull() ?: 1

        val signedId = signedPreKeyId++
        val signedKeyPair = ECKeyPair.generate()
        val signedSig = identity.privateKey.calculateSignature(signedKeyPair.publicKey.serialize())
        val signedPreKey = SignedPreKeyRecord(signedId, System.currentTimeMillis(), signedKeyPair, signedSig)
        signedPreKeyStore.storeSignedPreKey(signedId, signedPreKey)

        val preKeyId = nextPreKeyId++
        val preKey = PreKeyRecord(preKeyId, ECKeyPair.generate())
        preKeyStore.storePreKey(preKeyId, preKey)

        val kyberId = kyberPreKeyId++
        val kyberPair = KEMKeyPair.generate(KEMKeyType.KYBER_1024)
        val kyberSig = identity.privateKey.calculateSignature(kyberPair.publicKey.serialize())
        val kyberRecord = KyberPreKeyRecord(kyberId, System.currentTimeMillis(), kyberPair, kyberSig)
        kyberPreKeyStore.storeKyberPreKey(kyberId, kyberRecord)
        savePreKeyCounters()

        return JSONObject()
            .put("registrationId", registrationId)
            .put("identityKey", B64.encode(identity.publicKey.serialize()))
            .put(
                "signedPreKey",
                JSONObject()
                    .put("keyId", signedId)
                    .put("publicKey", B64.encode(signedPreKey.keyPair.publicKey.serialize()))
                    .put("signature", B64.encode(signedPreKey.signature)),
            )
            .put(
                "preKeys",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("keyId", preKeyId)
                            .put("publicKey", B64.encode(preKey.keyPair.publicKey.serialize())),
                    ),
            )
            .put(
                "kyberPreKey",
                JSONObject()
                    .put("keyId", kyberId)
                    .put("publicKey", B64.encode(kyberRecord.keyPair.publicKey.serialize()))
                    .put("signature", B64.encode(kyberRecord.signature)),
            )
    }

    private fun bundleFromServer(peerBundle: JSONObject): PreKeyBundle {
        val deviceId = peerBundle.optInt("device_id", peerBundle.optInt("deviceId", 1))
        val prekeys = peerBundle.optJSONArray("prekeys")
            ?: peerBundle.optJSONArray("preKeys")
            ?: JSONArray()
        val firstPreKey = if (prekeys.length() > 0) prekeys.getJSONObject(0) else null
        val signed = peerBundle.optJSONObject("signed_prekey")
            ?: peerBundle.optJSONObject("signedPreKey")
            ?: throw IllegalArgumentException("signed_prekey_required")
        val kyber = peerBundle.optJSONObject("kyber_prekey")
            ?: peerBundle.optJSONObject("kyberPreKey")
            ?: throw IllegalArgumentException("kyber_prekey_required")

        val identityKey = IdentityKey(
            B64.decode(peerBundle.optString("identity_key", peerBundle.optString("identityKey"))),
        )
        val signedPub = ECPublicKey(
            B64.decode(signed.optString("public_key", signed.optString("publicKey"))),
        )
        val signedSig = B64.decode(signed.optString("signature", signed.optString("signed_prekey_signature")))

        var preKeyId = PreKeyBundle.NULL_PRE_KEY_ID
        var preKeyPub: ECPublicKey? = null
        if (firstPreKey != null) {
            preKeyId = firstPreKey.optInt("key_id", firstPreKey.optInt("keyId", PreKeyBundle.NULL_PRE_KEY_ID))
            val preKeyB64 = firstPreKey.optString("public_key", firstPreKey.optString("publicKey", ""))
            if (preKeyB64.isNotEmpty()) {
                preKeyPub = ECPublicKey(B64.decode(preKeyB64))
            }
        }

        val kyberId = kyber.optInt("key_id", kyber.optInt("keyId", 0))
        val kyberPub = KEMPublicKey(B64.decode(kyber.optString("public_key", kyber.optString("publicKey"))))
        val kyberSig = B64.decode(kyber.optString("signature"))

        return PreKeyBundle(
            peerBundle.optInt("registration_id", peerBundle.optInt("registrationId")),
            deviceId,
            preKeyId,
            preKeyPub,
            signed.optInt("key_id", signed.optInt("keyId", signed.optInt("signed_prekey_id"))),
            signedPub,
            signedSig,
            identityKey,
            kyberId,
            kyberPub,
            kyberSig,
        )
    }

    fun establishSession(peerId: String, deviceId: String, peerBundle: JSONObject): JSONObject {
        val remote = peerAddress(peerId, deviceId)
        val bundle = bundleFromServer(peerBundle)
        SessionBuilder(
            sessionStore,
            preKeyStore,
            signedPreKeyStore,
            identityStore,
            remote,
            localAddress(),
        ).process(bundle, Instant.now())
        return JSONObject().put("ok", true)
    }

    fun encryptMessage(plaintext: String, peerId: String, deviceId: String): JSONObject {
        val cipher = sessionCipher(peerId, deviceId)
        val message = cipher.encrypt(plaintext.toByteArray(Charsets.UTF_8), Instant.now())
        return JSONObject()
            .put("ciphertext", B64.encode(message.serialize()))
            .put("messageType", message.type)
    }

    fun decryptMessage(ciphertextB64: String, peerId: String, deviceId: String): String {
        val cipher = sessionCipher(peerId, deviceId)
        val bytes = B64.decode(ciphertextB64)
        val plaintext = when (bytes[0].toInt()) {
            CiphertextMessage.PREKEY_TYPE -> {
                cipher.decrypt(PreKeySignalMessage(bytes))
            }
            else -> {
                cipher.decrypt(SignalMessage(bytes))
            }
        }
        return String(plaintext, Charsets.UTF_8)
    }

    fun computeSafetyNumber(peerId: String, peerIdentityKeyB64: String): JSONObject {
        val pair = identityStore.identityKeyPair
        val remoteKey = IdentityKey(B64.decode(peerIdentityKeyB64))
        val localUser = meta.localUserId ?: "ssc-local"
        val generator = NumericFingerprintGenerator(5200)
        val fingerprint = generator.createFor(
            2,
            localUser.toByteArray(Charsets.UTF_8),
            pair.publicKey,
            peerId.toByteArray(Charsets.UTF_8),
            remoteKey,
        )
        return JSONObject()
            .put("displayable", fingerprint.displayableFingerprint.displayText)
            .put("localUser", localUser)
            .put("peerId", peerId)
    }

    fun encryptBytes(bufferB64: String): JSONObject {
        val bytes = B64.decode(bufferB64)
        val cipher = Aes256GcmSiv(fileEncryptionKey())
        val nonce = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val ciphertext = cipher.encrypt(bytes, nonce, ByteArray(0))
        val payload = JSONObject()
            .put("v", 2)
            .put("type", "ssc_file")
            .put("nonce", B64.encode(nonce))
            .put("data", B64.encode(ciphertext))
        return JSONObject().put("ciphertext", B64.encode(payload.toString().toByteArray(Charsets.UTF_8)))
    }

    fun decryptBytes(ciphertextB64: String): JSONObject {
        val outer = JSONObject(String(B64.decode(ciphertextB64), Charsets.UTF_8))
        if (outer.optString("type") != "ssc_file" || !outer.has("nonce") || !outer.has("data")) {
            throw IllegalArgumentException("ssc_file_invalid_envelope")
        }
        val cipher = Aes256GcmSiv(fileEncryptionKey())
        val plain = cipher.decrypt(
            B64.decode(outer.getString("data")),
            B64.decode(outer.getString("nonce")),
            ByteArray(0),
        )
        return JSONObject().put("buffer", B64.encode(plain))
    }
}