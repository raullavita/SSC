package com.supersecurechat.app.data

import org.json.JSONArray
import org.json.JSONObject

class SocialRepository(
    private val http: SscHttpClient,
) {
    data class FriendRequest(
        val id: String,
        val fromUserId: String?,
        val toUserId: String?,
        val status: String,
        val note: String?,
    )

    fun incomingRequests(): List<FriendRequest> {
        val json = http.requestJson("/api/friend_requests/incoming", "GET")
        return parseRequests(json.optJSONArray("requests"))
    }

    fun outgoingRequests(): List<FriendRequest> {
        val json = http.requestJson("/api/friend_requests/outgoing", "GET")
        return parseRequests(json.optJSONArray("requests"))
    }

    fun sendRequest(toUserId: String, note: String = "") {
        http.requestJson(
            "/api/friend_requests",
            "POST",
            JSONObject().put("to_user_id", toUserId).put("note", note),
        )
    }

    fun accept(requestId: String) {
        http.requestJson("/api/friend_requests/$requestId/accept", "POST")
    }

    fun decline(requestId: String) {
        http.requestJson("/api/friend_requests/$requestId/decline", "POST")
    }

    fun block(targetUserId: String) {
        http.requestJson(
            "/api/abuse/block",
            "POST",
            JSONObject().put("target_user_id", targetUserId),
        )
    }

    fun unblock(targetUserId: String) {
        http.requestJson("/api/abuse/block/$targetUserId", "DELETE")
    }

    fun listBlocks(): JSONArray {
        return http.requestJson("/api/abuse/blocks", "GET").optJSONArray("blocks") ?: JSONArray()
    }

    fun report(
        targetUserId: String,
        reason: String,
        conversationId: String? = null,
        alsoBlock: Boolean = false,
    ) {
        val body = JSONObject()
            .put("target_user_id", targetUserId)
            .put("reason", reason)
            .put("also_block", alsoBlock)
        if (!conversationId.isNullOrBlank()) body.put("conversation_id", conversationId)
        http.requestJson("/api/abuse/report", "POST", body)
    }

    private fun parseRequests(arr: JSONArray?): List<FriendRequest> {
        if (arr == null) return emptyList()
        val out = ArrayList<FriendRequest>(arr.length())
        for (i in 0 until arr.length()) {
            val r = arr.getJSONObject(i)
            out.add(
                FriendRequest(
                    id = r.optString("id", r.optString("_id", "")),
                    fromUserId = r.optString("from_user_id").ifBlank { null },
                    toUserId = r.optString("to_user_id").ifBlank { null },
                    status = r.optString("status", "pending"),
                    note = r.optString("note").ifBlank { null },
                ),
            )
        }
        return out
    }
}
