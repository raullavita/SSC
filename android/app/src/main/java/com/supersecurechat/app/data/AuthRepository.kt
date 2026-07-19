package com.supersecurechat.app.data

import com.supersecurechat.app.BuildConfig
import org.json.JSONObject

class AuthRepository(
    private val http: SscHttpClient,
    private val session: SessionStore,
) {
    data class User(
        val id: String,
        val displayName: String,
        val email: String? = null,
        val username: String? = null,
    )

    data class PublicConfig(
        val captchaRequired: Boolean,
        val turnstileSiteKey: String?,
        val nativeBridgeRequired: Boolean = true,
    )

    /** Server policy for installed clients (captcha, SFU flags, etc.). */
    fun publicConfig(): PublicConfig {
        val json = http.requestJson("/api/config", "GET")
        return PublicConfig(
            captchaRequired = json.optBoolean("captcha_required", false),
            turnstileSiteKey = json.optString("turnstile_site_key").ifBlank { null },
            nativeBridgeRequired = json.optBoolean("native_bridge_required", true),
        )
    }

    fun login(email: String, password: String, captchaToken: String? = null): User {
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
        if (!captchaToken.isNullOrBlank()) body.put("captcha_token", captchaToken)
        val json = http.requestJson("/api/auth/login", "POST", body)
        return applyAuthResponse(json)
    }

    fun register(email: String, password: String, displayName: String, captchaToken: String? = null): User {
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .put("display_name", displayName.trim())
        if (!captchaToken.isNullOrBlank()) {
            body.put("captcha_token", captchaToken)
        }
        val json = http.requestJson("/api/auth/register", "POST", body)
        return applyAuthResponse(json)
    }

    fun exchangeGoogleOAuthCode(oauthCode: String): User {
        val json = http.requestJson(
            "/api/auth/google/exchange",
            "POST",
            JSONObject().put("oauth_code", oauthCode),
        )
        return applyAuthResponse(json)
    }

    fun googleStartUrl(): String {
        val base = BuildConfig.SSC_API_URL.trimEnd('/')
        return "$base/api/auth/google/start?client=installed"
    }

    fun me(): User {
        val json = http.requestJson("/api/auth/me", "GET")
        val user = json.optJSONObject("user") ?: json
        val id = user.optString("id", user.optString("_id", ""))
        val name = user.optString("display_name", "")
        val uname = user.optString("username").ifBlank { null }
        if (json.has("ws_token") && json.optString("ws_token").isNotBlank()) {
            session.accessToken = json.optString("ws_token")
        }
        session.userId = id
        session.displayName = name
        if (!uname.isNullOrBlank()) session.username = uname
        return User(id, name, user.optString("email").ifBlank { null }, uname)
    }

    fun logout() {
        try {
            http.post("/api/auth/logout")
        } catch (e: Exception) {
            android.util.Log.w("AuthRepository", "logout: ${e.message}")
        }
        session.clearSession()
    }

    fun panicWipeServer() {
        http.requestJson("/api/panic/wipe", "POST", JSONObject())
    }

    fun setupRecovery(passphrase: String) {
        http.requestJson(
            "/api/auth/recovery/setup",
            "POST",
            JSONObject().put("recovery_passphrase", passphrase),
        )
    }

    fun recoveryConfigured(): Boolean {
        return try {
            http.requestJson("/api/auth/recovery/status", "GET").optBoolean("configured", false)
        } catch (e: Exception) {
            android.util.Log.w("AuthRepository", "recoveryConfigured: ${e.message}")
            false
        }
    }

    /**
     * Recovery verify may require captcha in production.
     * Returns recovery_token for reset-password.
     */
    fun verifyRecovery(
        email: String,
        passphrase: String,
        captchaToken: String? = null,
    ): String {
        val body = JSONObject()
            .put("email", email.trim())
            .put("recovery_passphrase", passphrase)
        if (!captchaToken.isNullOrBlank()) body.put("captcha_token", captchaToken)
        val json = http.requestJson("/api/auth/recovery/verify", "POST", body)
        return json.getString("recovery_token")
    }

    fun resetPasswordWithRecovery(recoveryToken: String, newPassword: String): User {
        val json = http.requestJson(
            "/api/auth/recovery/reset-password",
            "POST",
            JSONObject()
                .put("recovery_token", recoveryToken)
                .put("new_password", newPassword),
        )
        // Some deployments issue session on reset
        return if (json.has("ws_token") || json.has("user")) {
            applyAuthResponse(json)
        } else {
            throw SscHttpClient.ApiException(0, "reset_ok_login_required")
        }
    }

    private fun applyAuthResponse(json: JSONObject): User {
        val token = json.optString("ws_token", "")
        if (token.isBlank()) throw SscHttpClient.ApiException(0, "missing_ws_token")
        val user = json.getJSONObject("user")
        val id = user.getString("id")
        val name = user.optString("display_name", "")
        val uname = user.optString("username").ifBlank { null }
        session.saveSession(token, id, name, uname)
        return User(id, name, user.optString("email").ifBlank { null }, uname)
    }
}
