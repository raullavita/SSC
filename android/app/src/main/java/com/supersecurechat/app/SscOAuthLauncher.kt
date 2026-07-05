package com.supersecurechat.app

import android.app.Activity
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

/**
 * Google OAuth must run in Chrome Custom Tabs — WebView shows raw gstatic/JS and Google blocks login.
 */
object SscOAuthLauncher {
    private const val API_HOST = "api.supersecurechat.com"

    fun isOAuthStart(url: String): Boolean {
        return try {
            val uri = Uri.parse(url)
            uri.host.equals(API_HOST, ignoreCase = true) &&
                uri.path?.startsWith("/api/auth/google") == true
        } catch (_: Exception) {
            false
        }
    }

    fun isGoogleAccounts(url: String): Boolean {
        return try {
            val host = Uri.parse(url).host?.lowercase() ?: return false
            host == "accounts.google.com" ||
                host == "oauth2.googleapis.com" ||
                host.endsWith(".googleusercontent.com")
        } catch (_: Exception) {
            false
        }
    }

    fun isOAuthFinish(url: String): Boolean {
        return try {
            val uri = Uri.parse(url)
            uri.host.equals(API_HOST, ignoreCase = true) &&
                uri.path == "/auth/google" &&
                (uri.getQueryParameter("oauth_code") != null || uri.getQueryParameter("error") != null)
        } catch (_: Exception) {
            false
        }
    }

    fun launchCustomTab(activity: Activity, url: String) {
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(activity, Uri.parse(url))
    }
}