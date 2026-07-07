package com.supersecurechat.app

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

/**
 * Launches OAuth flows inside a Chrome Custom Tab so the user stays within
 * the app's visual context without opening a full external browser.
 */
object SscOAuthLauncher {

    private const val OAUTH_START_HOST = "accounts.google.com"

    /**
     * Returns true when [url] is an OAuth authorisation URL that should be
     * intercepted and opened in a Custom Tab rather than loaded in the WebView.
     */
    fun isOAuthStart(url: String): Boolean {
        return try {
            val host = Uri.parse(url).host ?: return false
            host == OAUTH_START_HOST || host.endsWith(".${OAUTH_START_HOST}")
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Opens [url] in a Chrome Custom Tab attached to [context].
     */
    fun launch(context: Context, url: String) {
        val intent = CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
        intent.launchUrl(context, Uri.parse(url))
    }
}
