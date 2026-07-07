package com.supersecurechat.app.data.repository

import com.supersecurechat.app.data.api.SscHttpClient
import com.supersecurechat.app.data.model.Conversation
import com.supersecurechat.app.data.model.ConversationResponse
import com.supersecurechat.app.data.model.ConversationsResponse
import com.supersecurechat.app.data.model.CreateConversationRequest
import com.supersecurechat.app.data.model.UserLookupResponse
import kotlinx.serialization.json.Json

class ConversationRepository(
    private val http: SscHttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    suspend fun listConversations(): List<Conversation> {
        val body = http.get("/api/conversations")
        return json.decodeFromString(ConversationsResponse.serializer(), body).conversations
            .sortedWith(
                compareByDescending<Conversation> { it.pinned }
                    .thenByDescending { it.updatedAt.orEmpty() },
            )
    }

    suspend fun getConversation(conversationId: String): Conversation {
        val body = http.get("/api/conversations/$conversationId")
        return json.decodeFromString(ConversationResponse.serializer(), body).conversation
    }

    suspend fun createDirectConversation(participantId: String): Conversation {
        val payload = json.encodeToString(
            CreateConversationRequest.serializer(),
            CreateConversationRequest(participantId.trim()),
        )
        val body = http.post("/api/conversations", payload)
        return json.decodeFromString(ConversationResponse.serializer(), body).conversation
    }

    suspend fun lookupUser(target: String): String? {
        val trimmed = target.trim()
        if (trimmed.isBlank()) return null
        return try {
            val path = if (trimmed.startsWith("u_") || trimmed.length > 20) {
                "/api/users/lookup/$trimmed"
            } else {
                "/api/users/by-username/$trimmed"
            }
            val body = http.get(path)
            json.decodeFromString(UserLookupResponse.serializer(), body).user.id
        } catch (_: Exception) {
            null
        }
    }

    suspend fun markRead(conversationId: String, lastMessageId: String? = null) {
        val payload = if (lastMessageId != null) {
            """{"last_message_id":"$lastMessageId"}"""
        } else {
            "{}"
        }
        runCatching { http.post("/api/conversations/$conversationId/read", payload) }
    }
}