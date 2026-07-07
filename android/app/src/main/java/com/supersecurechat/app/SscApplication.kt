package com.supersecurechat.app

import android.app.Application
import com.supersecurechat.app.data.ChatSessionManager
import com.supersecurechat.app.data.api.SscHttpClient
import com.supersecurechat.app.data.repository.AuthRepository
import com.supersecurechat.app.data.repository.ConversationRepository
import com.supersecurechat.app.data.repository.CryptoRepository
import com.supersecurechat.app.data.repository.MessageRepository
import com.supersecurechat.app.data.session.SessionStore
import com.supersecurechat.app.data.ws.SscWebSocket

class SscApplication : Application() {
    lateinit var sessionStore: SessionStore
        private set

    lateinit var authRepository: AuthRepository
        private set

    lateinit var conversationRepository: ConversationRepository
        private set

    lateinit var messageRepository: MessageRepository
        private set

    lateinit var cryptoRepository: CryptoRepository
        private set

    lateinit var chatSessionManager: ChatSessionManager
        private set

    override fun onCreate() {
        super.onCreate()
        sessionStore = SessionStore(this)
        val httpClient = SscHttpClient.create(this)
        authRepository = AuthRepository(httpClient, sessionStore)
        cryptoRepository = CryptoRepository(httpClient)
        conversationRepository = ConversationRepository(httpClient)
        messageRepository = MessageRepository(httpClient, cryptoRepository)
        val webSocket = SscWebSocket(httpClient)
        chatSessionManager = ChatSessionManager(
            filesDir = filesDir,
            sessionStore = sessionStore,
            cryptoRepository = cryptoRepository,
            conversationRepository = conversationRepository,
            messageRepository = messageRepository,
            webSocket = webSocket,
        )
    }
}