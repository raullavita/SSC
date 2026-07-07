package com.supersecurechat.app

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

object SscOAuthLauncher {
    /**
     * Returns true when [url] is an OAuth authorisation start URL that should be
     * opened in a Chrome Custom Tab instead of the embedded WebView.
     */
    fun isOAuthStart(url: String): Boolean {
        return url.contains("/auth/google") ||
            url.contains("/oauth/") ||
            url.contains("accounts.google.com")
    }

    /** Open [url] in a Chrome Custom Tab. */
    fun launch(context: Context, url: String) {
        CustomTabsIntent.Builder()
            .build()
            .launchUrl(context, Uri.parse(url))
    }
}
