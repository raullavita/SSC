package com.supersecurechat.app.data.repository

import com.supersecurechat.app.data.api.SscHttpClient
import com.supersecurechat.app.data.model.ChatMessage
import com.supersecurechat.app.data.model.Conversation
import com.supersecurechat.app.data.model.Message
import com.supersecurechat.app.data.model.MessageResponse
import com.supersecurechat.app.data.model.MessagesResponse
import com.supersecurechat.app.data.model.SendMessageRequest
import kotlinx.serialization.json.Json

class MessageRepository(
    private val http: SscHttpClient,
    private val cryptoRepository: CryptoRepository,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    suspend fun loadMessages(
        conversation: Conversation,
        localUserId: String,
    ): List<ChatMessage> {
        val body = http.get("/api/conversations/${conversation.id}/messages")
        val wire = json.decodeFromString(MessagesResponse.serializer(), body).messages
        return wire.map { decodeMessage(it, conversation, localUserId) }
    }

    suspend fun sendTextMessage(
        conversation: Conversation,
        localUserId: String,
        plaintext: String,
    ): ChatMessage {
        if (conversation.type == "group") {
            throw IllegalStateException("group_chat_phase2b")
        }
        val peerId = conversation.peerId
            ?: throw IllegalStateException("direct_peer_missing")
        val (ciphertext, protocol) = cryptoRepository.encryptDirect(plaintext, peerId)
        val payload = json.encodeToString(
            SendMessageRequest.serializer(),
            SendMessageRequest(ciphertext = ciphertext, protocol = protocol),
        )
        val body = http.post("/api/conversations/${conversation.id}/messages", payload)
        val message = json.decodeFromString(MessageResponse.serializer(), body).message
        return decodeMessage(message, conversation, localUserId, overrideText = plaintext)
    }

    suspend fun decodeMessage(
        message: Message,
        conversation: Conversation,
        localUserId: String,
        overrideText: String? = null,
    ): ChatMessage {
        val isMine = message.senderId == localUserId
        if (message.messageKind == "deleted") {
            return ChatMessage(
                id = message.id,
                senderId = message.senderId,
                text = "Message deleted",
                createdAt = message.createdAt,
                isMine = isMine,
                isDeleted = true,
            )
        }
        if (conversation.type == "group") {
            return ChatMessage(
                id = message.id,
                senderId = message.senderId,
                text = "[Encrypted group message]",
                createdAt = message.createdAt,
                isMine = isMine,
            )
        }
        val ciphertext = message.ciphertext
        if (ciphertext.isNullOrBlank()) {
            return ChatMessage(
                id = message.id,
                senderId = message.senderId,
                text = "[Empty message]",
                createdAt = message.createdAt,
                isMine = isMine,
            )
        }
        val text = overrideText ?: runCatching {
            cryptoRepository.decryptDirect(ciphertext, message.senderId)
        }.getOrElse {
            return ChatMessage(
                id = message.id,
                senderId = message.senderId,
                text = "Unable to decrypt",
                createdAt = message.createdAt,
                isMine = isMine,
                decryptFailed = true,
            )
        }
        return ChatMessage(
            id = message.id,
            senderId = message.senderId,
            text = text,
            createdAt = message.createdAt,
            isMine = isMine,
        )
    }
}