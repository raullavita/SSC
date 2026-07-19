package com.supersecurechat.app.data

import android.util.Log
import org.json.JSONObject

class PresenceRepository(
    private val http: SscHttpClient,
) {
    fun heartbeat() {
        try {
            http.requestJson("/api/presence/heartbeat", "POST", JSONObject())
        } catch (e: Exception) {
            Log.w(TAG, "heartbeat: ${e.message}")
        }
    }

    fun lastSeen(subjectId: String, conversationId: String? = null): String? {
        return try {
            val path = buildString {
                append("/api/presence/users/$subjectId")
                if (!conversationId.isNullOrBlank()) {
                    append("?conversation_id=")
                    append(java.net.URLEncoder.encode(conversationId, "UTF-8"))
                }
            }
            val json = http.requestJson(path, "GET")
            json.optString("last_seen").ifBlank {
                json.optString("status").ifBlank { null }
            }
        } catch (e: Exception) {
            Log.w(TAG, "lastSeen: ${e.message}")
            null
        }
    }

    companion object {
        private const val TAG = "PresenceRepository"
    }
}
