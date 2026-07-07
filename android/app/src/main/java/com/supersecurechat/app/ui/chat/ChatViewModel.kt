package com.supersecurechat.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.supersecurechat.app.data.ChatSessionManager
import com.supersecurechat.app.data.api.ApiException
import com.supersecurechat.app.data.model.ChatMessage
import com.supersecurechat.app.data.model.Conversation
import com.supersecurechat.app.data.model.Message
import com.supersecurechat.app.data.repository.AuthRepository
import com.supersecurechat.app.data.repository.ConversationRepository
import com.supersecurechat.app.data.repository.MessageRepository
import com.supersecurechat.app.data.session.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject

data class ChatUiState(
    val isLoading: Boolean = true,
    val conversation: Conversation? = null,
    val title: String = "Chat",
    val messages: List<ChatMessage> = emptyList(),
    val draft: String = "",
    val isSending: Boolean = false,
    val error: String? = null,
    val localUserId: String? = null,
)

class ChatViewModel(
    private val conversationId: String,
    private val sessionStore: SessionStore,
    private val authRepository: AuthRepository,
    private val conversationRepository: ConversationRepository,
    private val messageRepository: MessageRepository,
    private val chatSessionManager: ChatSessionManager,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : ViewModel() {
    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val userId = runCatching { chatSessionManager.ensureReady() }
                .getOrElse { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = mapError(error),
                    )
                    return@launch
                } ?: run {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Session expired — go back and sign in again",
                )
                return@launch
            }
            _uiState.value = _uiState.value.copy(localUserId = userId)
            chatSessionManager.subscribeConversation(conversationId)
            observeRealtime(userId)
            load(userId)
        }
    }

    fun updateDraft(value: String) {
        _uiState.value = _uiState.value.copy(draft = value, error = null)
    }

    fun sendMessage() {
        val draft = _uiState.value.draft.trim()
        val conversation = _uiState.value.conversation ?: return
        val userId = _uiState.value.localUserId ?: return
        if (draft.isBlank() || _uiState.value.isSending) return
        if (conversation.type == "group") {
            _uiState.value = _uiState.value.copy(error = "Group E2E chat arrives in the next update")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSending = true, error = null)
            runCatching { messageRepository.sendTextMessage(conversation, userId, draft) }
                .onSuccess { sent ->
                    _uiState.value = _uiState.value.copy(
                        isSending = false,
                        draft = "",
                        messages = _uiState.value.messages + sent,
                    )
                    conversationRepository.markRead(conversation.id, sent.id)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isSending = false,
                        error = mapError(error),
                    )
                }
        }
    }

    private suspend fun load(userId: String) {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        runCatching {
            val conversation = conversationRepository.getConversation(conversationId)
            val messages = messageRepository.loadMessages(conversation, userId)
            conversation to messages
        }.onSuccess { (conversation, messages) ->
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                conversation = conversation,
                title = conversationTitle(conversation),
                messages = messages,
            )
            messages.lastOrNull()?.let { last ->
                conversationRepository.markRead(conversation.id, last.id)
            }
        }.onFailure { error ->
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                error = mapError(error),
            )
        }
    }

    private fun observeRealtime(userId: String) {
        viewModelScope.launch {
            chatSessionManager.wsEvents.collect { event ->
                if (event.type != "message") return@collect
                val payload = event.payload ?: return@collect
                val wire = runCatching {
                    val msgObj = payload["message"]?.jsonObject ?: return@collect
                    json.decodeFromJsonElement(Message.serializer(), msgObj)
                }.getOrNull() ?: return@collect
                if (wire.conversationId != conversationId) return@collect
                val conversation = _uiState.value.conversation ?: return@collect
                val decoded = messageRepository.decodeMessage(wire, conversation, userId) // suspend in launch
                if (_uiState.value.messages.any { it.id == decoded.id }) return@collect
                _uiState.value = _uiState.value.copy(
                    messages = _uiState.value.messages + decoded,
                )
                conversationRepository.markRead(conversationId, decoded.id)
            }
        }
    }

    private fun conversationTitle(conversation: Conversation): String {
        return when {
            conversation.type == "group" -> "Group ${conversation.groupId ?: conversation.id}"
            else -> "Chat ${conversation.peerId ?: conversation.id}"
        }
    }

    private fun mapError(error: Throwable): String = when (error) {
        is ApiException -> authRepository.humanizeError(error.detail)
        is IllegalStateException -> error.message ?: "Something went wrong"
        else -> error.message ?: "Something went wrong"
    }
}