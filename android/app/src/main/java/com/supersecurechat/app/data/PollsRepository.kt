package com.supersecurechat.app.data

import org.json.JSONArray
import org.json.JSONObject

/**
 * Encrypted polls — wire format matches frontend `chat/polls.js`:
 * create payload: { question, options: string[] }
 * vote payload: { option_index: number }
 * protocol: signal_v1_poll
 */
class PollsRepository(
    private val http: SscHttpClient,
) {
    companion object {
        const val PROTOCOL = "signal_v1_poll"
    }

    data class CreatedPoll(
        val pollId: String?,
        val messageId: String?,
    )

    data class PollContent(
        val question: String,
        val options: List<String>,
    )

    /** Parse decrypted poll ciphertext (frontend uses `question`, legacy Android used `q`). */
    fun parsePollText(text: String?): PollContent? {
        if (text.isNullOrBlank()) return null
        return try {
            val data = JSONObject(text)
            val question = data.optString("question").ifBlank {
                data.optString("q")
            }
            val opts = data.optJSONArray("options") ?: return null
            if (question.isBlank() || opts.length() < 2) return null
            val options = ArrayList<String>(opts.length())
            for (i in 0 until opts.length()) {
                options.add(opts.optString(i, "Option ${i + 1}"))
            }
            PollContent(question = question, options = options)
        } catch (_: Exception) {
            null
        }
    }

    fun createPoll(
        conversationId: String,
        ciphertext: String,
        optionCount: Int,
        protocol: String = PROTOCOL,
    ): CreatedPoll {
        val json = http.requestJson(
            "/api/conversations/$conversationId/polls",
            "POST",
            JSONObject()
                .put("ciphertext", ciphertext)
                .put("protocol", protocol)
                .put("option_count", optionCount),
        )
        val poll = json.optJSONObject("poll") ?: json
        val msg = json.optJSONObject("message")
        return CreatedPoll(
            pollId = poll.optString("id", poll.optString("_id")).ifBlank { null },
            messageId = msg?.optString("id")?.ifBlank { null }
                ?: poll.optString("message_id").ifBlank { null },
        )
    }

    fun vote(
        conversationId: String,
        pollId: String,
        ciphertext: String,
        protocol: String = PROTOCOL,
    ) {
        http.requestJson(
            "/api/conversations/$conversationId/polls/$pollId/votes",
            "POST",
            JSONObject().put("ciphertext", ciphertext).put("protocol", protocol),
        )
    }

    /** Build create payload JSON string for encryption. */
    fun buildCreatePlaintext(question: String, options: List<String>): String {
        val arr = JSONArray()
        options.forEach { arr.put(it) }
        return JSONObject()
            .put("question", question.trim())
            .put("options", arr)
            .toString()
    }

    /** Build vote payload JSON string for encryption. */
    fun buildVotePlaintext(optionIndex: Int): String {
        return JSONObject().put("option_index", optionIndex).toString()
    }
}
