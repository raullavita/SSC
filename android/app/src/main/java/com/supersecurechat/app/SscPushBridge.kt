package com.supersecurechat.app

import android.content.Context
import android.webkit.WebView
import org.json.JSONObject

/** Stores FCM token and injects window.sscPushToken for React pushRegister.js */
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

    fun injectIntoWebView(webView: WebView) {
        val token = getToken(webView.context) ?: return
        val js = buildString {
            append("window.sscPushToken=")
            append(JSONObject.quote(token))
            append(";window.sscPushPlatform='android';")
        }
        webView.post { webView.evaluateJavascript(js, null) }
    }
}