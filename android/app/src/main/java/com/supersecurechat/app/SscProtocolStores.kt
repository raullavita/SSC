package com.supersecurechat.app

import org.json.JSONObject
import org.signal.libsignal.protocol.IdentityKey
import org.signal.libsignal.protocol.IdentityKeyPair
import org.signal.libsignal.protocol.SignalProtocolAddress
import org.signal.libsignal.protocol.groups.state.SenderKeyRecord
import org.signal.libsignal.protocol.groups.state.SenderKeyStore
import org.signal.libsignal.protocol.state.IdentityKeyStore
import org.signal.libsignal.protocol.state.KyberPreKeyRecord
import org.signal.libsignal.protocol.state.KyberPreKeyStore
import org.signal.libsignal.protocol.state.PreKeyRecord
import org.signal.libsignal.protocol.state.PreKeyStore
import org.signal.libsignal.protocol.state.SessionRecord
import org.signal.libsignal.protocol.state.SessionStore
import org.signal.libsignal.protocol.state.SignedPreKeyRecord
import org.signal.libsignal.protocol.state.SignedPreKeyStore
import java.io.File
import java.util.UUID

class SscSessionStore(store: SscFileJsonStore) : SessionStore {
    private val backing = store

    override fun loadSession(address: SignalProtocolAddress): SessionRecord {
        val raw = backing.data.optString(address.toString(), "")
        if (raw.isEmpty()) return SessionRecord()
        return SessionRecord(B64.decode(raw))
    }

    override fun loadExistingSessions(addresses: List<SignalProtocolAddress>): List<SessionRecord> {
        return addresses.mapNotNull { address ->
            val raw = backing.data.optString(address.toString(), "")
            if (raw.isEmpty()) null else SessionRecord(B64.decode(raw))
        }
    }

    override fun getSubDeviceSessions(name: String): List<Int> = emptyList()

    override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) {
        backing.data.put(address.toString(), B64.encode(record.serialize()))
        backing.save()
    }

    override fun containsSession(address: SignalProtocolAddress): Boolean =
        backing.data.has(address.toString())

    override fun deleteSession(address: SignalProtocolAddress) {
        backing.data.remove(address.toString())
        backing.save()
    }

    override fun deleteAllSessions(name: String) {
        val keys = backing.data.keys().asSequence().toList()
        for (key in keys) {
            if (key.startsWith("$name:")) backing.data.remove(key)
        }
        backing.save()
    }
}

class SscIdentityStore(
    private val root: File,
    private val meta: SscSessionMeta,
) : IdentityKeyStore {
    private val identityFile = File(root, "identity.json")
    private val trustedFile = File(root, "trusted.json")
    private var pair: IdentityKeyPair? = null
    private var trusted: JSONObject = loadTrusted()

    private fun loadTrusted(): JSONObject {
        if (!trustedFile.exists()) return JSONObject()
        return try {
            JSONObject(SscSecureStore.readText(trustedFile))
        } catch (_: Exception) {
            JSONObject()
        }
    }

    private fun loadPair(): IdentityKeyPair {
        pair?.let { return it }
        if (identityFile.exists()) {
            val doc = JSONObject(SscSecureStore.readText(identityFile))
            pair = IdentityKeyPair(B64.decode(doc.getString("identityKeyPair")))
            meta.registrationId = doc.getInt("registrationId")
            meta.deviceId = doc.optString("deviceId", meta.deviceId)
            meta.localUserId = doc.optString("localUserId", "").takeIf { it.isNotEmpty() }
            return pair!!
        }
        val generated = IdentityKeyPair.generate()
        meta.registrationId = (1..16380).random()
        if (meta.deviceId.isEmpty()) meta.deviceId = "1"
        SscSecureStore.writeText(
            identityFile,
            JSONObject()
                .put("identityKeyPair", B64.encode(generated.serialize()))
                .put("registrationId", meta.registrationId)
                .put("deviceId", meta.deviceId)
                .put("localUserId", meta.localUserId ?: JSONObject.NULL)
                .toString(),
        )
        pair = generated
        return generated
    }

    override fun getIdentityKeyPair(): IdentityKeyPair = loadPair()

    override fun getLocalRegistrationId(): Int {
        loadPair()
        return meta.registrationId
    }

    override fun saveIdentity(
        address: SignalProtocolAddress,
        identityKey: IdentityKey,
    ): IdentityKeyStore.IdentityChange {
        val key = address.toString()
        val prev = trusted.optString(key, "")
        trusted.put(key, B64.encode(identityKey.serialize()))
        SscSecureStore.writeText(trustedFile, trusted.toString())
        return if (prev.isNotEmpty()) {
            IdentityKeyStore.IdentityChange.REPLACED_EXISTING
        } else {
            IdentityKeyStore.IdentityChange.NEW_OR_UNCHANGED
        }
    }

    override fun isTrustedIdentity(
        address: SignalProtocolAddress,
        identityKey: IdentityKey,
        direction: IdentityKeyStore.Direction,
    ): Boolean {
        val prev = trusted.optString(address.toString(), "")
        if (prev.isEmpty()) return true
        return prev == B64.encode(identityKey.serialize())
    }

    override fun getIdentity(address: SignalProtocolAddress): IdentityKey? {
        val raw = trusted.optString(address.toString(), "")
        if (raw.isEmpty()) return null
        return IdentityKey(B64.decode(raw))
    }
}

class SscPreKeyStore(store: SscFileJsonStore) : PreKeyStore {
    private val backing = store

    override fun loadPreKey(preKeyId: Int): PreKeyRecord {
        val raw = backing.data.optString(preKeyId.toString(), "")
        if (raw.isEmpty()) throw org.signal.libsignal.protocol.InvalidKeyIdException("prekey_missing:$preKeyId")
        return PreKeyRecord(B64.decode(raw))
    }

    override fun storePreKey(preKeyId: Int, record: PreKeyRecord) {
        backing.data.put(preKeyId.toString(), B64.encode(record.serialize()))
        backing.save()
    }

    override fun containsPreKey(preKeyId: Int): Boolean = backing.data.has(preKeyId.toString())

    override fun removePreKey(preKeyId: Int) {
        backing.data.remove(preKeyId.toString())
        backing.save()
    }
}

class SscSignedPreKeyStore(store: SscFileJsonStore) : SignedPreKeyStore {
    private val backing = store

    override fun loadSignedPreKey(signedPreKeyId: Int): SignedPreKeyRecord {
        val raw = backing.data.optString(signedPreKeyId.toString(), "")
        if (raw.isEmpty()) {
            throw org.signal.libsignal.protocol.InvalidKeyIdException("signed_prekey_missing:$signedPreKeyId")
        }
        return SignedPreKeyRecord(B64.decode(raw))
    }

    override fun loadSignedPreKeys(): List<SignedPreKeyRecord> {
        return backing.data.keys().asSequence()
            .mapNotNull { key ->
                val raw = backing.data.optString(key, "")
                if (raw.isEmpty()) null else SignedPreKeyRecord(B64.decode(raw))
            }
            .toList()
    }

    override fun storeSignedPreKey(signedPreKeyId: Int, record: SignedPreKeyRecord) {
        backing.data.put(signedPreKeyId.toString(), B64.encode(record.serialize()))
        backing.save()
    }

    override fun containsSignedPreKey(signedPreKeyId: Int): Boolean =
        backing.data.has(signedPreKeyId.toString())

    override fun removeSignedPreKey(signedPreKeyId: Int) {
        backing.data.remove(signedPreKeyId.toString())
        backing.save()
    }
}

class SscKyberPreKeyStore(store: SscFileJsonStore) : KyberPreKeyStore {
    private val backing = store

    override fun loadKyberPreKey(kyberPreKeyId: Int): KyberPreKeyRecord {
        val raw = backing.data.optString(kyberPreKeyId.toString(), "")
        if (raw.isEmpty()) {
            throw org.signal.libsignal.protocol.InvalidKeyIdException("kyber_prekey_missing:$kyberPreKeyId")
        }
        return KyberPreKeyRecord(B64.decode(raw))
    }

    override fun loadKyberPreKeys(): List<KyberPreKeyRecord> {
        return backing.data.keys().asSequence()
            .mapNotNull { key ->
                val raw = backing.data.optString(key, "")
                if (raw.isEmpty()) null else KyberPreKeyRecord(B64.decode(raw))
            }
            .toList()
    }

    override fun storeKyberPreKey(kyberPreKeyId: Int, record: KyberPreKeyRecord) {
        backing.data.put(kyberPreKeyId.toString(), B64.encode(record.serialize()))
        backing.save()
    }

    override fun containsKyberPreKey(kyberPreKeyId: Int): Boolean =
        backing.data.has(kyberPreKeyId.toString())

    override fun markKyberPreKeyUsed(
        kyberPreKeyId: Int,
        signedPreKeyId: Int,
        baseKey: org.signal.libsignal.protocol.ecc.ECPublicKey,
    ) {
        // SSC marks used in memory only for installed-client MVP.
    }
}

class SscSenderKeyStore(store: SscFileJsonStore) : SenderKeyStore {
    private val backing = store

    override fun storeSenderKey(
        sender: SignalProtocolAddress,
        distributionId: UUID,
        record: SenderKeyRecord,
    ) {
        val key = "${sender}:$distributionId"
        backing.data.put(key, B64.encode(record.serialize()))
        backing.save()
    }

    override fun loadSenderKey(sender: SignalProtocolAddress, distributionId: UUID): SenderKeyRecord? {
        val key = "${sender}:$distributionId"
        val raw = backing.data.optString(key, "")
        if (raw.isEmpty()) return null
        return SenderKeyRecord(B64.decode(raw))
    }
}

data class SscSessionMeta(
    var registrationId: Int = 0,
    var deviceId: String = "1",
    var localUserId: String? = null,
)