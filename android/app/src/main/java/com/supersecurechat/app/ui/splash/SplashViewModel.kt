package com.supersecurechat.app.ui.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.supersecurechat.app.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SplashDestination {
    data object Loading : SplashDestination
    data object Login : SplashDestination
    data object Home : SplashDestination
}

class SplashViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _destination = MutableStateFlow<SplashDestination>(SplashDestination.Loading)
    val destination: StateFlow<SplashDestination> = _destination.asStateFlow()

    fun checkSession() {
        if (_destination.value != SplashDestination.Loading) return
        viewModelScope.launch {
            val loggedIn = runCatching { authRepository.isLoggedIn() }.getOrDefault(false)
            _destination.value = if (loggedIn) SplashDestination.Home else SplashDestination.Login
        }
    }
}