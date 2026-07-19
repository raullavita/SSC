package com.supersecurechat.app

import android.content.Context

/** Stores FCM token for native push registration (no WebView). */
object SscPushBridge {
    private const val PREFS = "ssc_push"
    private const val KEY_TOKEN = "fcm_token"

    fun storeToken(context: Context, token: String) {
        if (token.length < 10) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, token)
            .apply()
    }

    fun getToken(context: Context): String? {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TOKEN, null)
            ?.takeIf { it.length >= 10 }
    }
}
