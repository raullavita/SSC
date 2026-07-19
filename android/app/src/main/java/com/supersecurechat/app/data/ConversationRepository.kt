package com.supersecurechat.app.data

import android.util.Log
import org.json.JSONObject

class ConversationRepository(
    private val http: SscHttpClient,
    private val db: LocalMessageDb,
    private val session: SessionStore,
    private val sesame: SesameRepository? = null,
) {
    companion object {
        private const val TAG = "ConversationRepo"
    }
    data class Conversation(
        val id: String,
        val type: String,
        val title: String,
        val peerId: String?,
        val groupId: String? = null,
        val updatedAt: String?,
        val unread: Int,
        val pinned: Boolean = false,
        val muted: Boolean = false,
    )

    data class Message(
        val id: String,
        val conversationId: String,
        val senderId: String?,
        val ciphertext: String?,
        val protocol: String?,
        val createdAt: String?,
        val plaintext: String? = null,
        val pollId: String? = null,
        val messageKind: String? = null,
    )

    fun listConversations(preferCache: Boolean = true): List<Conversation> {
        return try {
            val json = http.requestJson("/api/conversations", "GET")
            val arr = json.optJSONArray("conversations") ?: return db.listConversations()
            val out = ArrayList<Conversation>(arr.length())
            for (i in 0 until arr.length()) {
                val c = parseConversation(arr.getJSONObject(i))
                db.upsertConversation(c)
                out.add(c)
            }
            // Pinned first, then by server order / updated_at
            out.sortedWith(compareByDescending<Conversation> { it.pinned }.thenByDescending { it.updatedAt ?: "" })
        } catch (e: Exception) {
            Log.w(TAG, "listConversations: ${e.message}")
            if (preferCache) {
                db.listConversations().sortedWith(
                    compareByDescending<Conversation> { it.pinned }.thenByDescending { it.updatedAt ?: "" },
                )
            } else {
                throw SscHttpClient.ApiException(0, "conversations_unavailable")
            }
        }
    }

    fun setPinned(conversationId: String, pinned: Boolean) {
        http.requestJson(
            "/api/conversations/$conversationId/meta",
            "PATCH",
            JSONObject().put("pinned", pinned),
        )
    }

    fun setMuted(conversationId: String, muted: Boolean) {
        http.requestJson(
            "/api/conversations/$conversationId/meta",
            "PATCH",
            JSONObject().put("muted", muted),
        )
    }

    fun setChatPrivacy(
        conversationId: String,
        readReceipts: Boolean? = null,
        typingVisible: Boolean? = null,
        disappearingSecondsDefault: Int? = null,
    ) {
        val body = JSONObject()
        if (readReceipts != null) body.put("read_receipts", readReceipts)
        if (typingVisible != null) body.put("typing_visible", typingVisible)
        if (disappearingSecondsDefault != null) {
            body.put("disappearing_seconds_default", disappearingSecondsDefault)
        }
        if (body.length() == 0) return
        http.requestJson("/api/conversations/$conversationId/privacy", "PATCH", body)
    }

    fun createDirect(participantId: String): Conversation {
        val body = JSONObject().put("participant_id", participantId)
        val json = http.requestJson("/api/conversations", "POST", body)
        val c = json.optJSONObject("conversation") ?: json
        val conv = parseConversation(c)
        db.upsertConversation(conv)
        return conv
    }

    fun listMessages(conversationId: String, signal: SignalMessaging? = null): List<Message> {
        val raw = try {
            val json = http.requestJson("/api/conversations/$conversationId/messages", "GET")
            val arr = json.optJSONArray("messages") ?: return db.listMessages(conversationId)
            val out = ArrayList<Message>(arr.length())
            for (i in 0 until arr.length()) {
                val m = arr.getJSONObject(i)
                out.add(parseMessage(m, conversationId))
            }
            out
        } catch (e: Exception) {
            Log.w(TAG, "listMessages network: ${e.message}")
            return db.listMessages(conversationId)
        }

        val peerId = db.listConversations().find { it.id == conversationId }?.peerId
            ?: listConversations().find { it.id == conversationId }?.peerId

        val cached = db.listMessages(conversationId).associateBy { it.id }
        val decrypted = raw.map { msg ->
            val cachedPlain = cached[msg.id]?.plaintext
            val plain = when {
                !cachedPlain.isNullOrBlank() &&
                    cachedPlain != "[encrypted]" &&
                    cachedPlain != "[unable to decrypt]" &&
                    cachedPlain != "[sent]" -> cachedPlain
                else -> decryptIfPossible(msg, peerId, signal)
            }
            val withPlain = msg.copy(plaintext = plain)
            db.upsertMessage(withPlain)
            withPlain
        }
        return decrypted
    }

    fun sendCiphertext(
        conversationId: String,
        ciphertext: String,
        protocol: String = "signal_v1",
        plaintext: String? = null,
    ): Message {
        val body = JSONObject()
            .put("ciphertext", ciphertext)
            .put("protocol", protocol)
        val json = http.requestJson("/api/conversations/$conversationId/messages", "POST", body)
        val m = json.optJSONObject("message") ?: json
        val msg = parseMessage(m, conversationId).copy(plaintext = plaintext)
        db.upsertMessage(msg)
        return msg
    }

    fun markRead(conversationId: String, lastMessageId: String?) {
        val body = JSONObject()
        if (!lastMessageId.isNullOrBlank()) body.put("last_message_id", lastMessageId)
        try {
            http.requestJson("/api/conversations/$conversationId/read", "POST", body)
        } catch (e: Exception) {
            Log.w(TAG, "markRead: ${e.message}")
        }
    }

    fun sendTyping(conversationId: String, active: Boolean) {
        try {
            http.requestJson(
                "/api/conversations/$conversationId/typing",
                "POST",
                JSONObject().put("active", active),
            )
        } catch (e: Exception) {
            Log.w(TAG, "sendTyping: ${e.message}")
        }
    }

    fun sendCiphertextWithMeta(
        conversationId: String,
        ciphertext: String,
        protocol: String = "signal_v1",
        plaintext: String? = null,
        replyTo: String? = null,
        disappearingSeconds: Int? = null,
        deviceCiphertexts: Map<String, String>? = null,
        sealed: Boolean = false,
    ): Message {
        val body = JSONObject()
            .put("protocol", if (sealed && !protocol.endsWith("_sealed")) "${protocol}_sealed" else protocol)
        if (sealed) body.put("sealed", true)
        if (!deviceCiphertexts.isNullOrEmpty()) {
            val map = JSONObject()
            deviceCiphertexts.forEach { (k, v) -> map.put(k, v) }
            body.put("device_ciphertexts", map)
            // legacy single field for older clients / fanout fallback
            body.put("ciphertext", ciphertext.ifBlank { deviceCiphertexts.values.first() })
        } else {
            body.put("ciphertext", ciphertext)
        }
        if (!replyTo.isNullOrBlank()) body.put("reply_to", replyTo)
        if (disappearingSeconds != null && disappearingSeconds > 0) {
            body.put("disappearing_seconds", disappearingSeconds)
        }
        val json = http.requestJson("/api/conversations/$conversationId/messages", "POST", body)
        val m = json.optJSONObject("message") ?: json
        val msg = parseMessage(m, conversationId).copy(plaintext = plaintext)
        db.upsertMessage(msg)
        return msg
    }

    fun editMessage(
        messageId: String,
        ciphertext: String,
        protocol: String = "signal_v1",
        deviceCiphertexts: Map<String, String>? = null,
    ) {
        val body = JSONObject().put("protocol", protocol)
        if (!deviceCiphertexts.isNullOrEmpty()) {
            val map = JSONObject()
            deviceCiphertexts.forEach { (k, v) -> map.put(k, v) }
            body.put("device_ciphertexts", map)
            body.put("ciphertext", ciphertext.ifBlank { deviceCiphertexts.values.first() })
        } else {
            body.put("ciphertext", ciphertext)
        }
        http.requestJson("/api/messages/$messageId", "PATCH", body)
    }

    fun deleteMessage(messageId: String, scope: String = "me") {
        http.requestJson("/api/messages/$messageId?scope=$scope", "DELETE")
        db.deleteMessage(messageId)
    }

    fun fetchPeerIdentityKey(peerId: String, deviceId: String = "1"): String? {
        return try {
            val json = http.requestJson("/api/prekeys/users/$peerId/devices/$deviceId", "GET")
            val bundle = json.optJSONObject("bundle") ?: json
            bundle.optString("identity_key", bundle.optString("identityKey", "")).ifBlank { null }
        } catch (e: Exception) {
            Log.w(TAG, "fetchPeerIdentityKey: ${e.message}")
            null
        }
    }

    /**
     * Read receipts for messages you sent (peer has read up to message_id).
     * Returns set of message ids that have been read by someone else.
     */
    fun fetchReadMessageIds(conversationId: String): Set<String> {
        return try {
            val json = http.requestJson("/api/conversations/$conversationId/reads", "GET")
            val arr = json.optJSONArray("reads") ?: return emptySet()
            val out = HashSet<String>()
            for (i in 0 until arr.length()) {
                val r = arr.getJSONObject(i)
                val mid = r.optString("message_id").ifBlank { r.optString("last_message_id") }
                if (mid.isNotBlank()) out.add(mid)
            }
            out
        } catch (e: Exception) {
            Log.w(TAG, "fetchReadMessageIds: ${e.message}")
            emptySet()
        }
    }

    private fun decryptIfPossible(
        msg: Message,
        peerId: String?,
        signal: SignalMessaging?,
    ): String {
        if (signal == null) return msg.plaintext ?: msg.ciphertext?.let { "[encrypted]" } ?: ""
        val ct = msg.ciphertext
        if (ct.isNullOrBlank()) return msg.plaintext ?: ""
        val myId = session.userId
        val sender = msg.senderId
        val protocol = msg.protocol.orEmpty()
        return try {
            when {
                protocol == SignalMessaging.GROUP_SENDER_KEY_DIST_PROTOCOL ||
                    protocol.contains("sender_key_dist") -> {
                    if (sender != null) {
                        try {
                            signal.ingestGroupDistribution(sender, ct)
                        } catch (e: Exception) {
                            Log.w(TAG, "ingestGroupDistribution: ${e.message}")
                        }
                    }
                    "[sender key]"
                }
                protocol == SignalMessaging.GROUP_SENDER_KEY_PROTOCOL ||
                    protocol.contains("group_sender_key") -> {
                    if (sender != null) signal.decryptGroup(sender, ct) else "[encrypted]"
                }
                sender != null && sender != myId -> {
                    try {
                        signal.decrypt(ct, sender)
                    } catch (e: Exception) {
                        Log.w(TAG, "decrypt peer failed, sesame retry: ${e.message}")
                        sesame?.requestRetry(msg.id, msg.conversationId)
                        throw e
                    }
                }
                !peerId.isNullOrBlank() -> {
                    try {
                        signal.decrypt(ct, peerId)
                    } catch (e: Exception) {
                        Log.w(TAG, "decrypt fallback failed, sesame retry: ${e.message}")
                        sesame?.requestRetry(msg.id, msg.conversationId)
                        msg.plaintext ?: if (sender == myId) "✓ Sent" else "Message unavailable"
                    }
                }
                sender == myId -> msg.plaintext ?: "✓ Sent"
                else -> "[encrypted]"
            }
        } catch (e: Exception) {
            Log.w(TAG, "decryptIfPossible: ${e.message}")
            if (sender == myId) {
                msg.plaintext ?: "✓ Sent"
            } else {
                sesame?.requestRetry(msg.id, msg.conversationId)
                // Do not show raw crypto failure strings in the bubble forever
                msg.plaintext ?: "Message unavailable"
            }
        }
    }

    private fun parseMessage(m: JSONObject, conversationId: String): Message {
        return Message(
            id = m.optString("id", m.optString("_id", "")),
            conversationId = conversationId.ifBlank {
                m.optString("conversation_id", "")
            },
            senderId = m.optString("sender_id").ifBlank { null },
            ciphertext = m.optString("ciphertext").ifBlank { null },
            protocol = m.optString("protocol").ifBlank { null },
            createdAt = m.optString("created_at").ifBlank { null },
            pollId = m.optString("poll_id").ifBlank { null },
            messageKind = m.optString("message_kind").ifBlank { null },
        )
    }

    private fun parseConversation(c: JSONObject): Conversation {
        val id = c.optString("id", c.optString("_id", ""))
        val type = c.optString("type", "direct")
        val peerId = c.optString("peer_id").ifBlank {
            c.optString("other_user_id").ifBlank { "" }
        }.ifBlank { null }
        val groupId = c.optString("group_id").ifBlank { null }
        val cachedTitle = db.contactTitle(peerId)
        val title = when {
            c.has("title") && !c.isNull("title") && c.optString("title").isNotBlank() -> c.optString("title")
            c.has("name") && c.optString("name").isNotBlank() -> c.optString("name")
            !cachedTitle.isNullOrBlank() -> cachedTitle
            type == "group" -> groupId ?: "Group"
            !peerId.isNullOrBlank() -> peerId
            else -> id
        }
        return Conversation(
            id = id,
            type = type,
            title = title.ifBlank { "Chat" },
            peerId = peerId,
            groupId = groupId,
            updatedAt = c.optString("updated_at").ifBlank { null },
            unread = c.optInt("unread_count", c.optInt("unread", 0)),
            pinned = c.optBoolean("pinned", false),
            muted = c.optBoolean("muted", false),
        )
    }
}
