package com.supersecurechat.app.data.repository

import com.supersecurechat.app.data.api.ApiException
import com.supersecurechat.app.data.api.SscHttpClient
import com.supersecurechat.app.data.model.AuthResponse
import com.supersecurechat.app.data.model.GoogleExchangeRequest
import com.supersecurechat.app.data.model.LoginRequest
import com.supersecurechat.app.data.model.PublicConfig
import com.supersecurechat.app.data.model.RegisterRequest
import com.supersecurechat.app.data.model.User
import com.supersecurechat.app.data.session.SessionStore
import kotlinx.serialization.json.Json

class AuthRepository(
    private val http: SscHttpClient,
    private val sessionStore: SessionStore,
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchPublicConfig(): PublicConfig {
        val body = http.get("/api/config")
        return json.decodeFromString(PublicConfig.serializer(), body)
    }

    suspend fun login(email: String, password: String): User {
        val payload = json.encodeToString(
            LoginRequest.serializer(),
            LoginRequest(email.trim(), password),
        )
        return persistAuth(http.post("/api/auth/login", payload))
    }

    suspend fun register(
        email: String,
        password: String,
        displayName: String,
        captchaToken: String? = null,
    ): User {
        val payload = json.encodeToString(
            RegisterRequest.serializer(),
            RegisterRequest(
                email = email.trim(),
                password = password,
                displayName = displayName.trim(),
                captchaToken = captchaToken,
            ),
        )
        return persistAuth(http.post("/api/auth/register", payload))
    }

    suspend fun exchangeGoogleOAuthCode(oauthCode: String): User {
        val payload = json.encodeToString(
            GoogleExchangeRequest.serializer(),
            GoogleExchangeRequest(oauthCode.trim()),
        )
        return persistAuth(http.post("/api/auth/google/exchange", payload))
    }

    suspend fun refreshCurrentUser(): User? {
        return try {
            val body = http.get("/api/auth/me")
            val user = json.decodeFromString(User.serializer(), body)
            val wsToken = sessionStore.wsToken()
            if (wsToken != null) {
                sessionStore.saveSession(user, wsToken)
            }
            user
        } catch (e: ApiException) {
            if (e.statusCode == 401) {
                logout()
                null
            } else {
                throw e
            }
        }
    }

    suspend fun logout() {
        runCatching { http.post("/api/auth/logout", "{}") }
        http.cookieJar.clear()
        sessionStore.clear()
    }

    suspend fun isLoggedIn(): Boolean {
        if (sessionStore.currentUser() == null) return false
        return refreshCurrentUser() != null
    }

    private suspend fun persistAuth(body: String): User {
        val auth = json.decodeFromString(AuthResponse.serializer(), body)
        sessionStore.saveSession(auth.user, auth.wsToken)
        return auth.user
    }

    fun humanizeError(detail: String): String = when {
        detail.contains("invalid_credentials") -> "Invalid email or password"
        detail.contains("email_already_registered") -> "This email is already registered"
        detail.contains("captcha_required") -> "Complete the security check to register"
        detail.contains("captcha_invalid") -> "Security check failed — try again"
        detail.contains("invalid_oauth_code") -> "Google sign-in expired — try again"
        detail.contains("google_oauth_not_configured") -> "Google sign-in is not available"
        detail.contains("certificate_pin_mismatch") ->
            "Secure connection blocked — update the app"
        detail.contains("ssl_connection_failed") ->
            "Secure connection failed — check your connection"
        detail.contains("session_required") || detail.contains("invalid_token") ->
            "Session expired — sign in again"
        detail.contains("network_error") -> "Can't reach SSC — check your connection"
        detail.contains("device_attest") -> "Device verification required — update SSC"
        detail.contains("installed_client") -> "App version not accepted — update SSC"
        detail.contains("native_bridge_required") -> "Native client required"
        else -> detail.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
}