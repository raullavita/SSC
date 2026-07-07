package com.supersecurechat.app.ui.chats

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.supersecurechat.app.data.ChatSessionManager
import com.supersecurechat.app.data.api.ApiException
import com.supersecurechat.app.data.model.Conversation
import com.supersecurechat.app.data.repository.AuthRepository
import com.supersecurechat.app.data.repository.ConversationRepository
import com.supersecurechat.app.data.session.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ConversationListUiState(
    val isLoading: Boolean = true,
    val conversations: List<Conversation> = emptyList(),
    val displayName: String? = null,
    val error: String? = null,
    val newChatTarget: String = "",
    val isCreatingChat: Boolean = false,
    val navigateToChatId: String? = null,
    val sessionExpired: Boolean = false,
)

class ConversationListViewModel(
    private val sessionStore: SessionStore,
    private val authRepository: AuthRepository,
    private val conversationRepository: ConversationRepository,
    private val chatSessionManager: ChatSessionManager,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ConversationListUiState())
    val uiState: StateFlow<ConversationListUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            sessionStore.currentUser()?.let { user ->
                _uiState.value = _uiState.value.copy(displayName = user.displayName)
            }
            val ready = runCatching { chatSessionManager.ensureReady() }
                .getOrElse { error ->
                    if (isSessionError(error)) {
                        handleSessionExpired()
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = mapError(error),
                        )
                    }
                    return@launch
                }
            if (ready == null) {
                handleSessionExpired()
                return@launch
            }
            val cryptoWarning = chatSessionManager.cryptoInitError?.let { mapError(it) }
            observeRealtime()
            refresh(cryptoWarning)
        }
    }

    fun refresh(cryptoWarning: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = cryptoWarning)
            runCatching { conversationRepository.listConversations() }
                .onSuccess { list ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        conversations = list,
                        error = cryptoWarning,
                    )
                }
                .onFailure { error ->
                    if (isSessionError(error)) {
                        handleSessionExpired()
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = cryptoWarning ?: mapError(error),
                        )
                    }
                }
        }
    }

    fun updateNewChatTarget(value: String) {
        _uiState.value = _uiState.value.copy(newChatTarget = value, error = null)
    }

    fun startNewChat() {
        val target = _uiState.value.newChatTarget.trim()
        if (target.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Enter a user ID or username")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isCreatingChat = true, error = null)
            runCatching {
                val participantId = conversationRepository.lookupUser(target)
                    ?: throw IllegalStateException("user_not_found")
                conversationRepository.createDirectConversation(participantId)
            }.onSuccess { conversation ->
                refresh()
                _uiState.value = _uiState.value.copy(
                    isCreatingChat = false,
                    newChatTarget = "",
                    navigateToChatId = conversation.id,
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isCreatingChat = false,
                    error = mapError(error),
                )
            }
        }
    }

    fun consumeNavigation() {
        _uiState.value = _uiState.value.copy(navigateToChatId = null)
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            chatSessionManager.shutdown()
            authRepository.logout()
            onLoggedOut()
        }
    }

    private fun observeRealtime() {
        viewModelScope.launch {
            chatSessionManager.wsEvents.collect { event ->
                if (event.type == "sync_message" || event.type == "message") {
                    refresh()
                }
            }
        }
    }

    private suspend fun handleSessionExpired() {
        chatSessionManager.shutdown()
        authRepository.logout()
        _uiState.value = _uiState.value.copy(
            isLoading = false,
            sessionExpired = true,
            error = "Session expired — sign in again",
        )
    }

    private fun isSessionError(error: Throwable): Boolean {
        return error is ApiException && (
            error.detail.contains("session_required") ||
                error.detail.contains("invalid_token") ||
                error.detail.contains("session_revoked") ||
                error.statusCode == 401
            )
    }

    private fun mapError(error: Throwable): String = when (error) {
        is ApiException -> authRepository.humanizeError(error.detail)
        is IllegalStateException -> when (error.message) {
            "user_not_found" -> "User not found"
            else -> error.message ?: "Something went wrong"
        }
        else -> when {
            error.message?.contains("guardedMap", ignoreCase = true) == true ->
                "Encryption setup failed — reinstall the app or use an ARM64 device"
            else -> error.message ?: "Something went wrong"
        }
    }
}