package com.supersecurechat.app.data

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Local encrypted backup of message cache + lightweight metadata.
 * Signal store remains under filesDir/ssc-signal (optional include of file listing).
 */
class BackupRepository(
    private val context: Context,
    private val db: LocalMessageDb,
    private val session: SessionStore,
) {
    fun exportEncrypted(passphrase: String): File {
        val payload = JSONObject()
            .put("format", "ssc-backup-payload")
            .put("version", 2)
            .put("exported_at", System.currentTimeMillis())
            .put("user_id", session.userId)
            .put("device_id", session.deviceId)
            .put("conversations", conversationsJson())
            .put("messages", messagesJson())
        val envelope = encrypt(payload.toString(), passphrase)
        val out = File(context.cacheDir, "ssc-backup-${System.currentTimeMillis()}.sscbackup")
        out.writeText(envelope.toString())
        return out
    }

    fun importEncrypted(file: File, passphrase: String) {
        val envelope = JSONObject(file.readText())
        val plain = decrypt(envelope, passphrase)
        val payload = JSONObject(plain)
        if (payload.optString("format") != "ssc-backup-payload") {
            throw IllegalArgumentException("invalid_backup_format")
        }
        // Restore contacts titles only; full message restore best-effort
        val messages = payload.optJSONArray("messages") ?: return
        for (i in 0 until messages.length()) {
            val m = messages.getJSONObject(i)
            db.upsertMessage(
                ConversationRepository.Message(
                    id = m.optString("id"),
                    conversationId = m.optString("conversation_id"),
                    senderId = m.optString("sender_id").ifBlank { null },
                    ciphertext = m.optString("ciphertext").ifBlank { null },
                    protocol = m.optString("protocol").ifBlank { null },
                    createdAt = m.optString("created_at").ifBlank { null },
                    plaintext = m.optString("plaintext").ifBlank { null },
                ),
            )
        }
        val convs = payload.optJSONArray("conversations") ?: return
        for (i in 0 until convs.length()) {
            val c = convs.getJSONObject(i)
            db.upsertConversation(
                ConversationRepository.Conversation(
                    id = c.optString("id"),
                    type = c.optString("type", "direct"),
                    title = c.optString("title", "Chat"),
                    peerId = c.optString("peer_id").ifBlank { null },
                    groupId = c.optString("group_id").ifBlank { null },
                    updatedAt = c.optString("updated_at").ifBlank { null },
                    unread = c.optInt("unread", 0),
                ),
            )
        }
    }

    private fun conversationsJson(): org.json.JSONArray {
        val arr = org.json.JSONArray()
        db.listConversations().forEach { c ->
            arr.put(
                JSONObject()
                    .put("id", c.id)
                    .put("type", c.type)
                    .put("title", c.title)
                    .put("peer_id", c.peerId)
                    .put("group_id", c.groupId)
                    .put("updated_at", c.updatedAt)
                    .put("unread", c.unread),
            )
        }
        return arr
    }

    private fun messagesJson(): org.json.JSONArray {
        val arr = org.json.JSONArray()
        db.listConversations().forEach { c ->
            db.listMessages(c.id).forEach { m ->
                arr.put(
                    JSONObject()
                        .put("id", m.id)
                        .put("conversation_id", m.conversationId)
                        .put("sender_id", m.senderId)
                        .put("ciphertext", m.ciphertext)
                        .put("protocol", m.protocol)
                        .put("created_at", m.createdAt)
                        .put("plaintext", m.plaintext),
                )
            }
        }
        return arr
    }

    private fun encrypt(plaintext: String, passphrase: String): JSONObject {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val key = derive(passphrase, salt)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ct = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        return JSONObject()
            .put("v", 1)
            .put("alg", "AES-256-GCM")
            .put("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
            .put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            .put("ct", Base64.encodeToString(ct, Base64.NO_WRAP))
    }

    private fun decrypt(envelope: JSONObject, passphrase: String): String {
        val salt = Base64.decode(envelope.getString("salt"), Base64.NO_WRAP)
        val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
        val ct = Base64.decode(envelope.getString("ct"), Base64.NO_WRAP)
        val key = derive(passphrase, salt)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        return String(cipher.doFinal(ct), Charsets.UTF_8)
    }

    private fun derive(passphrase: String, salt: ByteArray): SecretKeySpec {
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val spec = PBEKeySpec(passphrase.toCharArray(), salt, 120_000, 256)
        val raw = factory.generateSecret(spec).encoded
        return SecretKeySpec(raw, "AES")
    }
}
