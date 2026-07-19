package com.supersecurechat.app.data

import android.content.Context
import com.supersecurechat.app.GroupSenderKeySession
import com.supersecurechat.app.LibsignalSession
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Native libsignal facade for Compose UI — no JS bridge.
 * Upload shape matches frontend `signalBridge.toServerPrekeyPayload`.
 */
class SignalMessaging(
    context: Context,
    private val http: SscHttpClient,
    private val session: SessionStore,
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val filesDir = context.applicationContext.filesDir
    private val lib = LibsignalSession(filesDir)
    private val groupKeys = GroupSenderKeySession(filesDir)

    fun configureLocalIdentity() {
        val userId = session.userId ?: return
        val cfg = JSONObject()
            .put("localUserId", userId)
            .put("deviceId", session.deviceId)
        lib.configure(cfg)
        groupKeys.configure(cfg)
    }

    fun ensurePrekeysUploaded() {
        configureLocalIdentity()
        val local = lib.generatePreKeyBatch(50)
        val payload = toServerPrekeyPayload(local, session.deviceId)
        http.requestJson("/api/prekeys/bundle", "PUT", payload)
        maybeReplenishPrekeys()
    }

    /** If server reports low one-time prekeys, upload a fresh batch (replenish). */
    fun maybeReplenishPrekeys() {
        configureLocalIdentity()
        try {
            val status = http.requestJson(
                "/api/prekeys/status?device_id=${session.deviceId}",
                "GET",
            )
            if (!status.optBoolean("prekeys_low", false)) return
            val batch = lib.generatePreKeyBatchOnly(50)
            val preKeys = batch.optJSONArray("preKeys") ?: return
            val mapped = JSONArray()
            for (i in 0 until preKeys.length()) {
                val pk = preKeys.getJSONObject(i)
                mapped.put(
                    JSONObject()
                        .put("key_id", pk.optInt("keyId", pk.optInt("key_id", 0)))
                        .put("public_key", pk.optString("publicKey", pk.optString("public_key", ""))),
                )
            }
            http.requestJson(
                "/api/prekeys/replenish",
                "POST",
                JSONObject()
                    .put("device_id", session.deviceId)
                    .put("prekeys", mapped),
            )
        } catch (_: Exception) {
            // non-fatal — full bundle upload already ran
        }
    }

    fun prekeyStatusSummary(): String {
        return try {
            val status = http.requestJson(
                "/api/prekeys/status?device_id=${session.deviceId}",
                "GET",
            )
            val remaining = status.optInt("prekeys_remaining", -1)
            val low = status.optBoolean("prekeys_low", false)
            if (remaining >= 0) {
                "Prekeys: $remaining${if (low) " (low — will replenish)" else ""}"
            } else {
                "Prekeys: unknown"
            }
        } catch (_: Exception) {
            "Prekeys: unavailable"
        }
    }

    fun establishWithPeer(peerId: String, deviceId: String = "1") {
        configureLocalIdentity()
        val response = http.requestJson("/api/prekeys/users/$peerId/devices/$deviceId", "GET")
        val bundle = response.optJSONObject("bundle") ?: response
        lib.establishSession(peerId, deviceId, bundle)
    }

    /** List peer device ids that have prekey bundles registered. */
    fun listPeerDeviceIds(userId: String): List<String> {
        return try {
            val json = http.requestJson("/api/prekeys/users/$userId", "GET")
            val arr = json.optJSONArray("devices") ?: return listOf("1")
            val out = ArrayList<String>()
            for (i in 0 until arr.length()) {
                val d = arr.getJSONObject(i)
                val id = d.optString("device_id", d.optString("deviceId", "")).ifBlank { null }
                if (!id.isNullOrBlank()) out.add(id)
            }
            if (out.isEmpty()) listOf("1") else out
        } catch (_: Exception) {
            listOf("1")
        }
    }

    fun encrypt(plaintext: String, peerId: String, deviceId: String = "1"): Pair<String, String> {
        configureLocalIdentity()
        val result = lib.encryptMessage(plaintext, peerId, deviceId)
        val ciphertext = result.getString("ciphertext")
        return ciphertext to "signal_v1"
    }

    /**
     * Sesame-style multi-device encrypt: one ciphertext per peer device (+ own other devices).
     * Returns device_ciphertexts map + legacy single ciphertext for older servers.
     */
    data class MultiDeviceEnvelope(
        val deviceCiphertexts: Map<String, String>,
        val legacyCiphertext: String,
        val protocol: String = "signal_v1",
    )

    fun encryptForAllDevices(
        plaintext: String,
        peerId: String,
        includeSelfDevices: Boolean = true,
    ): MultiDeviceEnvelope {
        configureLocalIdentity()
        val map = LinkedHashMap<String, String>()
        val peerDevices = listPeerDeviceIds(peerId)
        for (deviceId in peerDevices) {
            try {
                establishWithPeer(peerId, deviceId)
            } catch (_: Exception) {
            }
            try {
                val (ct, _) = encrypt(plaintext, peerId, deviceId)
                map[deviceId] = ct
            } catch (_: Exception) {
            }
        }
        if (map.isEmpty()) {
            establishWithPeer(peerId, "1")
            val (ct, _) = encrypt(plaintext, peerId, "1")
            map["1"] = ct
        }
        val localUser = session.userId
        val localDevice = session.deviceId
        if (includeSelfDevices && !localUser.isNullOrBlank() && localUser != peerId) {
            for (ownId in listPeerDeviceIds(localUser)) {
                if (ownId == localDevice) continue
                try {
                    establishWithPeer(localUser, ownId)
                    val (ct, _) = encrypt(plaintext, localUser, ownId)
                    map[ownId] = ct
                } catch (_: Exception) {
                }
            }
        }
        val legacy = map[peerDevices.firstOrNull() ?: "1"] ?: map.values.first()
        return MultiDeviceEnvelope(map, legacy)
    }

    fun decrypt(ciphertext: String, peerId: String, deviceId: String = "1"): String {
        configureLocalIdentity()
        return lib.decryptMessage(ciphertext, peerId, deviceId)
    }

    /** Create sender-key distribution ciphertext for a group (send once per group on this device). */
    fun createGroupDistribution(groupId: String): String {
        configureLocalIdentity()
        return groupKeys.createDistributionMessage(groupId).getString("ciphertext")
    }

    fun processGroupDistribution(senderId: String, ciphertextB64: String, deviceId: String = "1") {
        configureLocalIdentity()
        groupKeys.processDistribution(senderId, deviceId, ciphertextB64)
    }

    /**
     * Post sender-key distribution to the group conversation (same as frontend groupSenderKeys).
     * Must run before first group encrypt so peers can process dist messages.
     */
    fun ensureGroupKeysDistributed(conversationId: String, groupId: String) {
        configureLocalIdentity()
        val state = groupKeys.getDistributionState(groupId)
        if (state.optBoolean("distributed", false)) return
        val dist = groupKeys.createDistributionMessage(groupId)
        val ciphertext = dist.getString("ciphertext")
        http.requestJson(
            "/api/conversations/$conversationId/messages",
            "POST",
            JSONObject()
                .put("ciphertext", ciphertext)
                .put("protocol", GROUP_SENDER_KEY_DIST_PROTOCOL),
        )
        groupKeys.markDistributionSent(groupId)
    }

    fun encryptGroup(conversationId: String, groupId: String, plaintext: String): Pair<String, String> {
        configureLocalIdentity()
        ensureGroupKeysDistributed(conversationId, groupId)
        val ct = groupKeys.encryptGroupPlaintext(groupId, plaintext)
        return ct to GROUP_SENDER_KEY_PROTOCOL
    }

    fun decryptGroup(senderId: String, ciphertext: String, deviceId: String = "1"): String {
        configureLocalIdentity()
        return groupKeys.decryptGroupCiphertext(senderId, deviceId, ciphertext)
    }

    fun ingestGroupDistribution(senderId: String, ciphertext: String, deviceId: String = "1") {
        processGroupDistribution(senderId, ciphertext, deviceId)
    }

    companion object {
        const val GROUP_SENDER_KEY_PROTOCOL = "group_sender_key_v2"
        const val GROUP_SENDER_KEY_DIST_PROTOCOL = "group_sender_key_dist_v1"
    }

    fun encryptFileBytes(bufferB64: String): String {
        configureLocalIdentity()
        return lib.encryptBytes(bufferB64).getString("ciphertext")
    }

    fun decryptFileBytes(ciphertextB64: String): ByteArray {
        configureLocalIdentity()
        val bufferB64 = lib.decryptBytes(ciphertextB64).getString("buffer")
        return android.util.Base64.decode(bufferB64, android.util.Base64.NO_WRAP)
    }

    fun safetyNumber(peerId: String, peerIdentityKeyB64: String): String {
        configureLocalIdentity()
        return lib.computeSafetyNumber(peerId, peerIdentityKeyB64).optString("displayable", "")
    }

    fun wipeLocalCrypto() {
        val root = java.io.File(filesDir, "ssc-signal")
        if (root.exists()) root.deleteRecursively()
    }

    fun runOnCryptoThread(block: () -> Unit) {
        executor.execute {
            try {
                block()
            } catch (_: Exception) {
            }
        }
    }

    private fun toServerPrekeyPayload(bundle: JSONObject, deviceId: String): JSONObject {
        val signed = bundle.optJSONObject("signedPreKey") ?: bundle.optJSONObject("signed_prekey") ?: JSONObject()
        val preKeys = bundle.optJSONArray("preKeys") ?: bundle.optJSONArray("prekeys") ?: JSONArray()
        val mappedPrekeys = JSONArray()
        for (i in 0 until preKeys.length()) {
            val pk = preKeys.getJSONObject(i)
            mappedPrekeys.put(
                JSONObject()
                    .put("key_id", pk.optInt("keyId", pk.optInt("key_id", 0)))
                    .put("public_key", pk.optString("publicKey", pk.optString("public_key", ""))),
            )
        }
        val kyber = bundle.optJSONObject("kyberPreKey") ?: bundle.optJSONObject("kyber_prekey")
        val out = JSONObject()
            .put("device_id", deviceId)
            .put("registration_id", bundle.optInt("registrationId", bundle.optInt("registration_id", 1)))
            .put("identity_key", bundle.optString("identityKey", bundle.optString("identity_key", "")))
            .put(
                "signed_prekey",
                JSONObject()
                    .put("key_id", signed.optInt("keyId", signed.optInt("key_id", 1)))
                    .put("public_key", signed.optString("publicKey", signed.optString("public_key", "")))
                    .put("signature", signed.optString("signature", "")),
            )
            .put("prekeys", mappedPrekeys)
        if (kyber != null) {
            out.put(
                "kyber_prekey",
                JSONObject()
                    .put("key_id", kyber.optInt("keyId", kyber.optInt("key_id", 1)))
                    .put("public_key", kyber.optString("publicKey", kyber.optString("public_key", "")))
                    .put("signature", kyber.optString("signature", "")),
            )
        }
        return out
    }
}
