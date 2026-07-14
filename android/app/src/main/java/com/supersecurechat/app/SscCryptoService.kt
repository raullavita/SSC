package com.supersecurechat.app

import org.json.JSONObject
import java.io.File

object SscCryptoService {
    @Volatile
    private var session: LibsignalSession? = null

    @Volatile
    private var groupSession: GroupSenderKeySession? = null

    @Volatile
    private var filesDir: File? = null

    fun bind(filesDir: File) {
        this.filesDir = filesDir
    }

    private fun libsignal(): LibsignalSession {
        val dir = filesDir ?: throw IllegalStateException("ssc_crypto_not_bound")
        return session ?: synchronized(this) {
            session ?: LibsignalSession(dir).also { session = it }
        }
    }

    private fun groupKeys(): GroupSenderKeySession {
        val dir = filesDir ?: throw IllegalStateException("ssc_crypto_not_bound")
        return groupSession ?: synchronized(this) {
            groupSession ?: GroupSenderKeySession(dir).also { groupSession = it }
        }
    }

    fun available(): Boolean = true

    fun dispatch(method: String, args: JSONObject): Any {
        return when (method) {
            "available" -> JSONObject().put("ok", available())
            "configure" -> {
                libsignal().configure(args)
                JSONObject().put("ok", true)
            }
            "generatePreKeyBundle" -> libsignal().generatePreKeyBundle()
            "generatePreKeyBatch" -> libsignal().generatePreKeyBatch(args.optInt("count", 50))
            "generatePreKeyBatchOnly" -> libsignal().generatePreKeyBatchOnly(args.optInt("count", 50))
            "rotateSignedPreKey" -> libsignal().rotateSignedPreKey()
            "establishSession" -> libsignal().establishSession(
                args.getString("peerId"),
                args.optString("deviceId", "1"),
                args.getJSONObject("bundle"),
            )
            "encryptMessage" -> libsignal().encryptMessage(
                args.getString("plaintext"),
                args.getString("peerId"),
                args.optString("deviceId", "1"),
            )
            "decryptMessage" -> libsignal().decryptMessage(
                args.getString("ciphertext"),
                args.getString("peerId"),
                args.optString("deviceId", "1"),
            )
            "encryptBytes" -> libsignal().encryptBytes(args.getString("buffer"))
            "decryptBytes" -> libsignal().decryptBytes(args.getString("ciphertext"))
            "computeSafetyNumber" -> libsignal().computeSafetyNumber(
                args.getString("peerId"),
                args.getString("peerIdentityKey"),
            )
            "wipeLocalData" -> wipeLocalData()
            "configureGroupKeys" -> {
                groupKeys().configure(args)
                JSONObject().put("ok", true)
            }
            "getGroupDistributionState" -> groupKeys().getDistributionState(args.getString("groupId"))
            "createGroupDistribution" -> groupKeys().createDistributionMessage(args.getString("groupId"))
            "markGroupDistributionSent" -> groupKeys().markDistributionSent(args.getString("groupId"))
            "processGroupDistribution" -> groupKeys().processDistribution(
                args.getString("senderId"),
                args.optString("deviceId", "1"),
                args.getString("ciphertext"),
            )
            "encryptGroupMessage" -> JSONObject().put(
                "ciphertext",
                groupKeys().encryptGroupPlaintext(args.getString("groupId"), args.getString("plaintext")),
            )
            "decryptGroupMessage" -> JSONObject().put(
                "plaintext",
                groupKeys().decryptGroupCiphertext(
                    args.getString("senderId"),
                    args.optString("deviceId", "1"),
                    args.getString("ciphertext"),
                ),
            )
            else -> throw IllegalArgumentException("unknown_method:$method")
        }
    }

    fun wipeLocalData(): JSONObject {
        val dir = filesDir ?: throw IllegalStateException("ssc_crypto_not_bound")
        val root = File(dir, "ssc-signal")
        if (root.exists()) {
            root.deleteRecursively()
        }
        session = null
        groupSession = null
        return JSONObject().put("ok", true)
    }
}