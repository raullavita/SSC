package com.supersecurechat.app.data

import org.json.JSONObject

/** Encrypted reactions — same wire format as frontend (ciphertext of JSON {emoji,target}). */
class ReactionsRepository(
    private val http: SscHttpClient,
) {
    companion object {
        const val PROTOCOL = "signal_v1_reaction"
    }

    data class Reaction(
        val id: String,
        val targetMessageId: String,
        val senderId: String?,
        val ciphertext: String?,
        val protocol: String?,
        val mine: Boolean = false,
        val emoji: String? = null,
    )

    fun addReaction(
        conversationId: String,
        targetMessageId: String,
        ciphertext: String,
        protocol: String = PROTOCOL,
    ) {
        http.requestJson(
            "/api/conversations/$conversationId/reactions",
            "POST",
            JSONObject()
                .put("target_message_id", targetMessageId)
                .put("ciphertext", ciphertext)
                .put("protocol", protocol),
        )
    }

    fun removeReaction(reactionId: String) {
        http.requestJson("/api/reactions/$reactionId", "DELETE")
    }

    fun listForConversation(conversationId: String): List<Reaction> {
        return try {
            val json = http.requestJson("/api/conversations/$conversationId/reactions", "GET")
            val arr = json.optJSONArray("reactions") ?: return emptyList()
            val out = ArrayList<Reaction>(arr.length())
            for (i in 0 until arr.length()) {
                val r = arr.getJSONObject(i)
                out.add(
                    Reaction(
                        id = r.optString("id", r.optString("_id", "")),
                        targetMessageId = r.optString("target_message_id", ""),
                        senderId = r.optString("sender_id").ifBlank { null },
                        ciphertext = r.optString("ciphertext").ifBlank { null },
                        protocol = r.optString("protocol").ifBlank { null },
                        mine = r.optBoolean("mine", false),
                    ),
                )
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Decrypt reactions and aggregate emoji counts by target message id.
     * Returns map: messageId -> "👍 2  ❤️ 1"
     */
    fun aggregateByTarget(
        conversationId: String,
        signal: SignalMessaging,
        peerId: String?,
        myId: String?,
    ): Map<String, String> {
        val raw = listForConversation(conversationId)
        if (raw.isEmpty()) return emptyMap()
        val emojiByTarget = HashMap<String, MutableMap<String, Int>>()
        for (r in raw) {
            val target = r.targetMessageId
            if (target.isBlank()) continue
            val emoji = decryptEmoji(r, signal, peerId, myId) ?: continue
            val counts = emojiByTarget.getOrPut(target) { LinkedHashMap() }
            counts[emoji] = (counts[emoji] ?: 0) + 1
        }
        return emojiByTarget.mapValues { (_, counts) ->
            counts.entries.joinToString("  ") { (e, n) ->
                if (n > 1) "$e$n" else e
            }
        }
    }

    private fun decryptEmoji(
        r: Reaction,
        signal: SignalMessaging,
        peerId: String?,
        myId: String?,
    ): String? {
        val ct = r.ciphertext ?: return null
        val sender = r.senderId
        return try {
            val plain = when {
                sender != null && sender != myId -> signal.decrypt(ct, sender)
                !peerId.isNullOrBlank() -> {
                    try {
                        signal.decrypt(ct, peerId)
                    } catch (_: Exception) {
                        // own reaction: may decrypt with peer session
                        null
                    }
                }
                else -> null
            } ?: return null
            val data = JSONObject(plain)
            data.optString("emoji").ifBlank { null }
        } catch (_: Exception) {
            null
        }
    }

    fun parseReactionText(text: String?): Pair<String, String>? {
        if (text.isNullOrBlank()) return null
        return try {
            val data = JSONObject(text)
            val emoji = data.optString("emoji")
            val target = data.optString("target")
            if (emoji.isNotBlank() && target.isNotBlank()) emoji to target else null
        } catch (_: Exception) {
            null
        }
    }
}
