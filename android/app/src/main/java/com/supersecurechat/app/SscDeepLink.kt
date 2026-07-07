package com.supersecurechat.app

import android.content.Intent
import android.net.Uri

/**
 * Resolves ssc:// deep links and HTTPS app-links to the corresponding
 * web-shell URL served from the bundled assets (file:///android_asset/www/index.html).
 */
object SscDeepLink {

    private const val SCHEME = "ssc"
    private const val BASE_URL = "file:///android_asset/www/index.html"

    /**
     * Maps an inbound [Intent] to a web path inside the bundled shell, or returns
     * null when the intent is not a deep link (e.g. a normal launcher launch).
     */
    fun resolveToWebUrl(intent: Intent?): String? {
        val data: Uri = intent?.data ?: return null
        return when {
            data.scheme == SCHEME -> resolveCustomScheme(data)
            data.scheme == "https" -> resolveAppLink(data)
            else -> null
        }
    }

    private fun resolveCustomScheme(uri: Uri): String {
        val host = uri.host?.lowercase() ?: return BASE_URL
        val path = uri.path?.trimStart('/') ?: ""
        val query = uri.query?.let { "?$it" } ?: ""
        return when (host) {
            "link-device" -> "${BASE_URL}#/link-device${query}"
            "add" -> if (path.isNotEmpty()) "${BASE_URL}#/add/$path" else "${BASE_URL}#/add"
            "auth" -> "${BASE_URL}#/auth${query}"
            else -> BASE_URL
        }
    }

    private fun resolveAppLink(uri: Uri): String {
        val path = uri.path ?: return BASE_URL
        val query = uri.query?.let { "?$it" } ?: ""
        return "${BASE_URL}#${path}${query}"
    }
}
