package com.supersecurechat.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null,
)

@Serializable
data class AuthResponse(
    val user: User,
    @SerialName("ws_token") val wsToken: String,
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
) {
    override fun toString(): String = "LoginRequest(email=$email, password=***)"
}

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    @SerialName("display_name") val displayName: String,
    @SerialName("captcha_token") val captchaToken: String? = null,
) {
    override fun toString(): String =
        "RegisterRequest(email=$email, password=***, displayName=$displayName)"
}

@Serializable
data class GoogleExchangeRequest(
    @SerialName("oauth_code") val oauthCode: String,
)

@Serializable
data class ApiErrorResponse(
    val detail: String? = null,
)

@Serializable
data class PublicConfig(
    @SerialName("captcha_required") val captchaRequired: Boolean = false,
    @SerialName("turnstile_site_key") val turnstileSiteKey: String? = null,
)