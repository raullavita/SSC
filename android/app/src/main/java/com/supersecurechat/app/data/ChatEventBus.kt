package com.supersecurechat.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

/**
 * Lightweight bus for realtime chat UX (typing, etc.) without WebView.
 */
class ChatEventBus {
    data class TypingState(
        val conversationId: String?,
        val userId: String?,
        val active: Boolean,
        val atMs: Long = System.currentTimeMillis(),
    )

    private val _typing = MutableStateFlow<TypingState?>(null)
    val typing: StateFlow<TypingState?> = _typing.asStateFlow()

    fun onWsEvent(type: String, payload: JSONObject, activeConversationId: String? = null) {
        val t = if (type == "typing") type else payload.optString("type")
        if (t != "typing") return
        val userId = payload.optString("user_id").ifBlank { null }
        val active = payload.optBoolean("active", true)
        // Conversation topic events often omit conversation_id; use active thread if provided.
        val convId = payload.optString("conversation_id").ifBlank {
            activeConversationId
        }
        _typing.value = TypingState(convId, userId, active)
    }

    fun clearTyping() {
        _typing.value = null
    }
}
