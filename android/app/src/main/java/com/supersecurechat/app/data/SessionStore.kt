package com.supersecurechat.app.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
/**
 * Secure session + device identity for the native Compose client.
 * Stores Bearer token (login `ws_token`) — no WebView cookie jar.
 */
class SessionStore(context: Context) {
    private val appContext = context.applicationContext

    private val prefs by lazy {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            appContext,
            "ssc_native_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var accessToken: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_TOKEN, value).apply()
        }

    var userId: String?
        get() = prefs.getString(KEY_USER_ID, null)
        set(value) {
            prefs.edit().putString(KEY_USER_ID, value).apply()
        }

    var displayName: String?
        get() = prefs.getString(KEY_DISPLAY_NAME, null)
        set(value) {
            prefs.edit().putString(KEY_DISPLAY_NAME, value).apply()
        }

    var username: String?
        get() = prefs.getString(KEY_USERNAME, null)
        set(value) {
            prefs.edit().putString(KEY_USERNAME, value).apply()
        }

    /**
     * Numeric device id for libsignal + API (`X-SSC-Device-Id`).
     * Primary phone client uses "1"; linked devices get server-allocated ids later.
     */
    val deviceId: String
        get() {
            val existing = prefs.getString(KEY_DEVICE_ID, null)
            if (!existing.isNullOrBlank() && existing.matches(Regex("^\\d{1,4}$"))) return existing
            prefs.edit().putString(KEY_DEVICE_ID, PRIMARY_DEVICE_ID).apply()
            return PRIMARY_DEVICE_ID
        }

    fun setLinkedDeviceId(id: String) {
        if (!id.matches(Regex("^\\d{1,4}$"))) return
        prefs.edit().putString(KEY_DEVICE_ID, id).apply()
    }

    /** Hide sender_id from recipients (server still routes delivery). */
    var sealedSenderEnabled: Boolean
        get() = prefs.getBoolean(KEY_SEALED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_SEALED, value).apply()
        }

    /** Default disappearing timer in seconds (0 = off). */
    var disappearingSecondsDefault: Int
        get() = prefs.getInt(KEY_DISAPPEARING, 0)
        set(value) {
            prefs.edit().putInt(KEY_DISAPPEARING, value.coerceIn(0, 86_400)).apply()
        }

    val isLoggedIn: Boolean
        get() = !accessToken.isNullOrBlank() && !userId.isNullOrBlank()

    fun saveSession(
        token: String,
        userId: String,
        displayName: String?,
        username: String?,
    ) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER_ID, userId)
            .putString(KEY_DISPLAY_NAME, displayName)
            .putString(KEY_USERNAME, username)
            .apply()
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_DISPLAY_NAME)
            .remove(KEY_USERNAME)
            .apply()
        // keep deviceId across logout
    }

    companion object {
        private const val PRIMARY_DEVICE_ID = "1"
        private const val KEY_TOKEN = "access_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_DISPLAY_NAME = "display_name"
        private const val KEY_USERNAME = "username"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_SEALED = "sealed_sender"
        private const val KEY_DISAPPEARING = "disappearing_seconds"
    }
}
