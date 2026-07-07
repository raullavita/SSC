package com.supersecurechat.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.supersecurechat.app.data.api.ApiException
import com.supersecurechat.app.data.model.User
import com.supersecurechat.app.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val user: User? = null,
    val captchaRequired: Boolean = false,
    val turnstileSiteKey: String? = null,
)

class AuthViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { authRepository.fetchPublicConfig() }
                .onSuccess { config ->
                    _uiState.value = _uiState.value.copy(
                        captchaRequired = config.captchaRequired,
                        turnstileSiteKey = config.turnstileSiteKey,
                    )
                }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Enter email and password")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            runCatching { authRepository.login(email, password) }
                .onSuccess { user ->
                    _uiState.value = _uiState.value.copy(isLoading = false, user = user)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = mapError(error),
                    )
                }
        }
    }

    fun register(email: String, password: String, displayName: String) {
        if (email.isBlank() || password.isBlank() || displayName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Fill in all fields")
            return
        }
        if (password.length < 8) {
            _uiState.value = _uiState.value.copy(error = "Password must be at least 8 characters")
            return
        }
        if (_uiState.value.captchaRequired) {
            _uiState.value = _uiState.value.copy(
                error = "Registration requires a security check — enable in a future update",
            )
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            runCatching { authRepository.register(email, password, displayName) }
                .onSuccess { user ->
                    _uiState.value = _uiState.value.copy(isLoading = false, user = user)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = mapError(error),
                    )
                }
        }
    }

    fun completeGoogleOAuth(oauthCode: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            runCatching { authRepository.exchangeGoogleOAuthCode(oauthCode) }
                .onSuccess { user ->
                    _uiState.value = _uiState.value.copy(isLoading = false, user = user)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = mapError(error),
                    )
                }
        }
    }

    fun reportGoogleOAuthError(message: String) {
        _uiState.value = _uiState.value.copy(error = mapError(Exception(message)))
    }

    fun consumeAuthenticatedUser() {
        _uiState.value = _uiState.value.copy(user = null)
    }

    private fun mapError(error: Throwable): String {
        return when (error) {
            is ApiException -> authRepository.humanizeError(error.detail)
            else -> error.message ?: "Something went wrong"
        }
    }
}