package com.supersecurechat.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class Conversation(
    val id: String,
    val type: String = "direct",
    @SerialName("peer_id") val peerId: String? = null,
    @SerialName("group_id") val groupId: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    val pinned: Boolean = false,
    val muted: Boolean = false,
    @SerialName("unread_count") val unreadCount: Int = 0,
)

@Serializable
data class ConversationsResponse(
    val conversations: List<Conversation> = emptyList(),
)

@Serializable
data class ConversationResponse(
    val conversation: Conversation,
)

@Serializable
data class CreateConversationRequest(
    @SerialName("participant_id") val participantId: String,
)

@Serializable
data class Message(
    val id: String,
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("sender_id") val senderId: String,
    val ciphertext: String? = null,
    val protocol: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("message_kind") val messageKind: String? = null,
    @SerialName("reply_to") val replyTo: String? = null,
)

@Serializable
data class MessagesResponse(
    val messages: List<Message> = emptyList(),
)

@Serializable
data class SendMessageRequest(
    val ciphertext: String,
    val protocol: String = "signal_v1",
    val sealed: Boolean = false,
    @SerialName("reply_to") val replyTo: String? = null,
)

@Serializable
data class MessageResponse(
    val message: Message,
)

@Serializable
data class UserLookupResponse(
    val user: PublicUser,
)

@Serializable
data class PublicUser(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null,
)

@Serializable
data class WsSubscribeTokenResponse(
    @SerialName("subscribe_token") val subscribeToken: String? = null,
    val topic: String,
    val required: Boolean = false,
)

@Serializable
data class PreKeyBundleResponse(
    val bundle: JsonObject? = null,
)

data class ChatMessage(
    val id: String,
    val senderId: String,
    val text: String,
    val createdAt: String?,
    val isMine: Boolean,
    val isDeleted: Boolean = false,
    val decryptFailed: Boolean = false,
)