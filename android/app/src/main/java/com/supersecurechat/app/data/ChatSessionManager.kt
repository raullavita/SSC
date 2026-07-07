package com.supersecurechat.app.data

import com.supersecurechat.app.data.repository.ConversationRepository
import com.supersecurechat.app.data.repository.CryptoRepository
import com.supersecurechat.app.data.repository.MessageRepository
import com.supersecurechat.app.data.session.SessionStore
import com.supersecurechat.app.data.ws.SscWebSocket
import com.supersecurechat.app.data.ws.WsEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import java.io.File

class ChatSessionManager(
    private val filesDir: File,
    private val sessionStore: SessionStore,
    private val cryptoRepository: CryptoRepository,
    private val conversationRepository: ConversationRepository,
    private val messageRepository: MessageRepository,
    private val webSocket: SscWebSocket,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    val wsEvents: SharedFlow<WsEvent> = webSocket.events

    suspend fun ensureReady(): String? {
        val user = sessionStore.currentUser() ?: return null
        val wsToken = sessionStore.wsToken() ?: return null
        cryptoRepository.bind(filesDir)
        runCatching { cryptoRepository.initialize(user.id) }
            .onFailure { cryptoInitError = it }
            .onSuccess { cryptoInitError = null }
        webSocket.connect(wsToken)
        runCatching { webSocket.subscribe("user:${user.id}") }
        return user.id
    }

    @Volatile
    var cryptoInitError: Throwable? = null
        private set

    fun subscribeConversation(conversationId: String) {
        scope.launch {
            webSocket.subscribe("conversation:$conversationId")
        }
    }

    fun shutdown() {
        webSocket.disconnect()
    }
}