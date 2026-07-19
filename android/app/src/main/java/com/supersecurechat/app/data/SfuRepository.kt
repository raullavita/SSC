package com.supersecurechat.app.data

import org.json.JSONObject

/** Group call SFU (mediasoup) room provisioning — matches backend /api/sfu routes. */
class SfuRepository(
    private val http: SscHttpClient,
) {
    data class SfuConfig(
        val enabled: Boolean,
        val wsUrl: String?,
        val maxParticipants: Int,
        val provider: String = "mediasoup",
    )

    data class SfuRoom(
        val roomId: String,
        val joinToken: String?,
        val wsUrl: String?,
        val provisioned: Boolean = false,
    )

    fun config(): SfuConfig {
        return try {
            val json = http.requestJson("/api/sfu/config", "GET")
            SfuConfig(
                enabled = json.optBoolean("enabled", false),
                wsUrl = json.optString("ws_url").ifBlank { null },
                maxParticipants = json.optInt("max_participants", 50),
                provider = json.optString("provider", "mediasoup"),
            )
        } catch (_: Exception) {
            SfuConfig(false, null, 0)
        }
    }

    fun createRoom(conversationId: String, expectedParticipants: Int = 4): SfuRoom {
        val json = http.requestJson(
            "/api/sfu/rooms",
            "POST",
            JSONObject()
                .put("conversation_id", conversationId)
                .put("expected_participants", expectedParticipants),
        )
        val room = json.optJSONObject("room") ?: json
        return SfuRoom(
            roomId = room.optString("room_id", room.optString("id", json.optString("room_id", ""))),
            joinToken = room.optString("join_token")
                .ifBlank { room.optString("token") }
                .ifBlank { json.optString("join_token") }
                .ifBlank { json.optString("token") }
                .ifBlank { null },
            wsUrl = room.optString("ws_url")
                .ifBlank { json.optString("ws_url") }
                .ifBlank { null },
            provisioned = room.optBoolean("provisioned", json.optBoolean("provisioned", true)),
        )
    }

    fun endRoom(roomId: String) {
        if (roomId.isBlank()) return
        try {
            http.requestJson("/api/sfu/rooms/$roomId/end", "POST", JSONObject())
        } catch (_: Exception) {
        }
    }
}
