package com.supersecurechat.app

import org.json.JSONObject
import org.signal.libsignal.protocol.SignalProtocolAddress
import org.signal.libsignal.protocol.groups.GroupCipher
import org.signal.libsignal.protocol.groups.GroupSessionBuilder
import org.signal.libsignal.protocol.message.SenderKeyDistributionMessage
import java.io.File
import java.util.UUID

class GroupSenderKeySession(filesDir: File) {
    private val root = File(filesDir, "ssc-signal")
    val meta = SscSessionMeta()
    private val metaStore = SscFileJsonStore(File(root, "sender_key_meta.json"))
    private val senderKeyStore = SscSenderKeyStore(SscFileJsonStore(File(root, "sender_keys.json")))

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

    private fun groupMeta(groupId: String): JSONObject {
        if (!metaStore.data.has("groups")) {
            metaStore.data.put("groups", JSONObject())
        }
        val groups = metaStore.data.getJSONObject("groups")
        if (!groups.has(groupId)) {
            groups.put(
                groupId,
                JSONObject()
                    .put("distributionId", UUID.randomUUID().toString())
                    .put("distributed", false),
            )
            metaStore.save()
        }
        return groups.getJSONObject(groupId)
    }

    fun getDistributionState(groupId: String): JSONObject {
        val group = groupMeta(groupId)
        return JSONObject()
            .put("distributionId", group.getString("distributionId"))
            .put("distributed", group.optBoolean("distributed", false))
    }

    fun markDistributionSent(groupId: String): JSONObject {
        val group = groupMeta(groupId)
        group.put("distributed", true)
        metaStore.save()
        return JSONObject().put("ok", true)
    }

    fun createDistributionMessage(groupId: String): JSONObject {
        val group = groupMeta(groupId)
        val distributionId = UUID.fromString(group.getString("distributionId"))
        val sender = localAddress()
        val dist = GroupSessionBuilder(senderKeyStore).create(sender, distributionId)
        return JSONObject()
            .put("distributionId", group.getString("distributionId"))
            .put("ciphertext", B64.encode(dist.serialize()))
    }

    fun processDistribution(senderId: String, deviceId: String, ciphertextB64: String): JSONObject {
        val sender = peerAddress(senderId, deviceId)
        val message = SenderKeyDistributionMessage(B64.decode(ciphertextB64))
        GroupSessionBuilder(senderKeyStore).process(sender, message)
        return JSONObject().put("ok", true)
    }

    fun encryptGroupPlaintext(groupId: String, plaintext: String): String {
        val group = groupMeta(groupId)
        val distributionId = UUID.fromString(group.getString("distributionId"))
        val sender = localAddress()
        val cipher = GroupCipher(senderKeyStore, sender)
        val message = cipher.encrypt(distributionId, plaintext.toByteArray(Charsets.UTF_8))
        return B64.encode(message.serialize())
    }

    fun decryptGroupCiphertext(senderId: String, deviceId: String, ciphertextB64: String): String {
        val sender = peerAddress(senderId, deviceId)
        val cipher = GroupCipher(senderKeyStore, sender)
        val plain = cipher.decrypt(B64.decode(ciphertextB64))
        return String(plain, Charsets.UTF_8)
    }
}