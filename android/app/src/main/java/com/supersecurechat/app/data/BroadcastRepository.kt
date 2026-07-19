package com.supersecurechat.app.data

import org.json.JSONArray
import org.json.JSONObject

class BroadcastRepository(
    private val http: SscHttpClient,
    private val signal: SignalMessaging,
    private val conversations: ConversationRepository,
) {
    data class BroadcastList(
        val id: String,
        val name: String,
        val recipientIds: List<String>,
    )

    fun list(): List<BroadcastList> {
        return try {
            val json = http.requestJson("/api/broadcast_lists", "GET")
            val arr = json.optJSONArray("broadcast_lists") ?: return emptyList()
            val out = ArrayList<BroadcastList>(arr.length())
            for (i in 0 until arr.length()) {
                val d = arr.getJSONObject(i)
                val recipients = d.optJSONArray("recipient_ids")
                val ids = ArrayList<String>()
                if (recipients != null) {
                    for (j in 0 until recipients.length()) {
                        ids.add(recipients.getString(j))
                    }
                }
                out.add(
                    BroadcastList(
                        id = d.optString("id", d.optString("_id", "")),
                        name = d.optString("name", "List"),
                        recipientIds = ids,
                    ),
                )
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun create(name: String, recipientIds: List<String>): BroadcastList {
        val arr = JSONArray()
        recipientIds.forEach { arr.put(it) }
        val json = http.requestJson(
            "/api/broadcast_lists",
            "POST",
            JSONObject().put("name", name.trim()).put("recipient_ids", arr),
        )
        val d = json.optJSONObject("broadcast_list") ?: json
        return BroadcastList(
            id = d.optString("id", d.optString("_id", "")),
            name = d.optString("name", name),
            recipientIds = recipientIds,
        )
    }

    fun delete(listId: String) {
        http.requestJson("/api/broadcast_lists/$listId", "DELETE")
    }

    /**
     * Send same plaintext to each recipient as separate 1:1 E2EE messages
     * (server has no bulk broadcast ciphertext route — client fans out).
     */
    fun sendToList(list: BroadcastList, plaintext: String): Int {
        var sent = 0
        for (peerId in list.recipientIds) {
            try {
                val conv = conversations.createDirect(peerId)
                val multi = signal.encryptForAllDevices(plaintext, peerId)
                conversations.sendCiphertextWithMeta(
                    conversationId = conv.id,
                    ciphertext = multi.legacyCiphertext,
                    protocol = multi.protocol,
                    plaintext = plaintext,
                    deviceCiphertexts = multi.deviceCiphertexts,
                    sealed = false,
                )
                sent++
            } catch (_: Exception) {
            }
        }
        return sent
    }
}
