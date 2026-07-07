package com.supersecurechat.app.oauth

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.supersecurechat.app.BuildConfig

object GoogleAuthHelper {
    private fun apiHost(): String =
        android.net.Uri.parse(BuildConfig.SSC_API_URL).host ?: "api.supersecurechat.com"

    fun googleStartUrl(): String =
        "${BuildConfig.SSC_API_URL.trimEnd('/')}/api/auth/google/start"

    fun launchGoogleSignIn(activity: Activity) {
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(activity, Uri.parse(googleStartUrl()))
    }

    fun parseOAuthCode(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        if (uri.scheme?.equals("ssc", ignoreCase = true) != true) return null
        if (uri.host?.equals("auth", ignoreCase = true) != true) return null
        return uri.getQueryParameter("oauth_code")?.takeIf { it.isNotBlank() }
    }

    fun parseOAuthError(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        if (uri.scheme?.equals("ssc", ignoreCase = true) != true) return null
        if (uri.host?.equals("auth", ignoreCase = true) != true) return null
        return uri.getQueryParameter("error")?.takeIf { it.isNotBlank() }
    }

    fun isOAuthFinishUrl(url: String): Boolean {
        return try {
            val uri = Uri.parse(url)
            uri.host.equals(apiHost(), ignoreCase = true) &&
                uri.path == "/auth/google" &&
                (uri.getQueryParameter("oauth_code") != null || uri.getQueryParameter("error") != null)
        } catch (_: Exception) {
            false
        }
    }
}