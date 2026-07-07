package com.supersecurechat.app

import android.content.Intent
import android.net.Uri

object SscDeepLink {
    private const val SCHEME = "ssc"
    private const val BUNDLED_BASE = "file:///android_asset/www"

    /**
     * Resolve an incoming [Intent] to a web URL loaded inside the bundled WebView shell.
     * Returns null when the intent carries no deep-link data that needs special routing.
     */
    fun resolveToWebUrl(intent: Intent?): String? {
        val data: Uri = intent?.data ?: return null
        if (data.scheme == SCHEME) {
            return when (data.host) {
                "link-device" -> {
                    val query = data.query?.let { "?$it" } ?: ""
                    "$BUNDLED_BASE/index.html#/link-device$query"
                }
                "add" -> {
                    val segment = data.pathSegments.firstOrNull() ?: ""
                    "$BUNDLED_BASE/index.html#/add/$segment"
                }
                "auth" -> "$BUNDLED_BASE/index.html#/auth${data.query?.let { "?$it" } ?: ""}"
                else -> null
            }
        }
        if (data.scheme == "https" && data.host == "www.supersecurechat.com") {
            return "$BUNDLED_BASE/index.html#${data.path ?: ""}"
        }
        return null
    }
}
