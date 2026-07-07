package com.supersecurechat.app.data.repository

import com.supersecurechat.app.SscCryptoService
import com.supersecurechat.app.data.api.SscHttpClient
import com.supersecurechat.app.data.model.PreKeyBundleResponse
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import org.json.JSONObject
import java.io.File

class CryptoRepository(
    private val http: SscHttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val deviceId = "1"

    fun bind(filesDir: File) {
        SscCryptoService.bind(filesDir)
    }

    suspend fun initialize(localUserId: String) {
        val config = JSONObject()
            .put("localUserId", localUserId)
            .put("deviceId", deviceId)
        SscCryptoService.dispatch("configure", config)
        SscCryptoService.dispatch("configureGroupKeys", config)
        registerDeviceAndPrekeys()
    }

    suspend fun encryptDirect(plaintext: String, peerId: String): Pair<String, String> {
        ensureSession(peerId)
        val result = SscCryptoService.dispatch(
            "encryptMessage",
            JSONObject()
                .put("plaintext", plaintext)
                .put("peerId", peerId)
                .put("deviceId", deviceId),
        ) as JSONObject
        return result.getString("ciphertext") to "signal_v1"
    }

    suspend fun decryptDirect(ciphertext: String, senderId: String): String {
        return SscCryptoService.dispatch(
            "decryptMessage",
            JSONObject()
                .put("ciphertext", ciphertext)
                .put("peerId", senderId)
                .put("deviceId", deviceId),
        ) as String
    }

    private suspend fun ensureSession(peerId: String) {
        val body = http.get("/api/prekeys/users/$peerId/devices/$deviceId")
        val response = json.decodeFromString(PreKeyBundleResponse.serializer(), body)
        val bundleJson = response.bundle?.let { serverBundleToOrgJson(it) }
            ?: throw IllegalStateException("prekey_bundle_missing")
        SscCryptoService.dispatch(
            "establishSession",
            JSONObject()
                .put("peerId", peerId)
                .put("deviceId", deviceId)
                .put("bundle", bundleJson),
        )
    }

    private suspend fun registerDeviceAndPrekeys() {
        val registerBody = buildJsonObject {
            put("device_id", deviceId)
            put("name", "SSC Android")
            put("platform", "android")
        }.toString()
        http.post("/api/devices", registerBody)

        val bundle = SscCryptoService.dispatch("generatePreKeyBundle", JSONObject()) as JSONObject
        val upload = buildJsonObject {
            put("device_id", deviceId)
            put("registration_id", bundle.getInt("registrationId"))
            put("identity_key", bundle.getString("identityKey"))
            putJsonObject("signed_prekey") {
                val spk = bundle.getJSONObject("signedPreKey")
                put("key_id", spk.getInt("keyId"))
                put("public_key", spk.getString("publicKey"))
                put("signature", spk.getString("signature"))
            }
            putJsonArray("prekeys") {
                val prekeys = bundle.getJSONArray("preKeys")
                for (i in 0 until prekeys.length()) {
                    val pk = prekeys.getJSONObject(i)
                    add(
                        buildJsonObject {
                            put("key_id", pk.getInt("keyId"))
                            put("public_key", pk.getString("publicKey"))
                        },
                    )
                }
            }
            putJsonObject("kyber_prekey") {
                val kyber = bundle.getJSONObject("kyberPreKey")
                put("key_id", kyber.getInt("keyId"))
                put("public_key", kyber.getString("publicKey"))
                put("signature", kyber.getString("signature"))
            }
        }.toString()
        http.put("/api/prekeys/bundle", upload)
    }

    private fun serverBundleToOrgJson(bundle: JsonObject): JSONObject {
        val signed = bundle["signed_prekey"]?.jsonObject
            ?: bundle["signedPreKey"]?.jsonObject
        val kyber = bundle["kyber_prekey"]?.jsonObject
            ?: bundle["kyberPreKey"]?.jsonObject
        val prekeys = bundle["prekeys"]?.jsonArray
            ?: bundle["preKeys"]?.jsonArray
        val out = JSONObject()
        bundle["user_id"]?.jsonPrimitive?.content?.let { out.put("user_id", it) }
        bundle["device_id"]?.jsonPrimitive?.content?.let { out.put("device_id", it) }
        bundle["registration_id"]?.jsonPrimitive?.int?.let { out.put("registration_id", it) }
        bundle["identity_key"]?.jsonPrimitive?.content?.let { out.put("identity_key", it) }
        if (signed != null) {
            out.put(
                "signed_prekey",
                JSONObject()
                    .put("key_id", signed["key_id"]?.jsonPrimitive?.int ?: signed["keyId"]?.jsonPrimitive?.int)
                    .put("public_key", signed["public_key"]?.jsonPrimitive?.content ?: signed["publicKey"]?.jsonPrimitive?.content)
                    .put("signature", signed["signature"]?.jsonPrimitive?.content),
            )
        }
        if (kyber != null) {
            out.put(
                "kyber_prekey",
                JSONObject()
                    .put("key_id", kyber["key_id"]?.jsonPrimitive?.int ?: kyber["keyId"]?.jsonPrimitive?.int)
                    .put("public_key", kyber["public_key"]?.jsonPrimitive?.content ?: kyber["publicKey"]?.jsonPrimitive?.content)
                    .put("signature", kyber["signature"]?.jsonPrimitive?.content),
            )
        }
        if (prekeys != null) {
            val arr = org.json.JSONArray()
            prekeys.forEach { element ->
                val pk = element.jsonObject
                arr.put(
                    JSONObject()
                        .put("key_id", pk["key_id"]?.jsonPrimitive?.int ?: pk["keyId"]?.jsonPrimitive?.int)
                        .put("public_key", pk["public_key"]?.jsonPrimitive?.content ?: pk["publicKey"]?.jsonPrimitive?.content),
                )
            }
            out.put("prekeys", arr)
        }
        return out
    }

}