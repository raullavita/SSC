package com.supersecurechat.app

import android.content.Intent
import android.net.Uri
import java.net.URLEncoder

/**
 * Resolve Android deep links and app links into installed-app routes.
 * Bundled WebView uses hash routes: file:///android_asset/www/index.html#/login
 */
object SscDeepLink {
    private const val WEB_HOST = "www.supersecurechat.com"

    fun resolveToWebUrl(intent: Intent?, fallback: String): String {
        val uri = intent?.data ?: return fallback
        return resolveUri(uri, fallback)
    }

    fun resolveUri(uri: Uri, fallback: String): String {
        val base = webBaseFrom(fallback)
        return when (uri.scheme?.lowercase()) {
            "ssc" -> webUrl(base, mapSscHost(uri))
            "https", "http" -> {
                if (!uri.host.equals(WEB_HOST, ignoreCase = true)) {
                    return fallback
                }
                val path = uri.encodedPath?.ifEmpty { "/" } ?: "/"
                val query = uri.encodedQuery?.let { "?$it" } ?: ""
                webUrl(base, "$path$query")
            }
            else -> fallback
        }
    }

    private fun mapSscHost(uri: Uri): String {
        val host = uri.host?.lowercase().orEmpty()
        return when (host) {
            "link-device" -> {
                val token = uri.getQueryParameter("token")
                if (token.isNullOrBlank()) {
                    "/link-device"
                } else {
                    "/link-device?token=${URLEncoder.encode(token, Charsets.UTF_8.name())}"
                }
            }
            "add" -> {
                val username = uri.path?.trim('/')?.lowercase().orEmpty()
                if (username.isBlank()) "/" else "/add/$username"
            }
            "auth" -> {
                val query = uri.encodedQuery?.let { "?$it" } ?: ""
                "/auth/google$query"
            }
            else -> "/"
        }
    }

    private fun webBaseFrom(fallback: String): String {
        if (fallback.startsWith("file://")) {
            return fallback.substringBefore('#').trimEnd('/')
        }
        return fallback
            .substringBefore('#')
            .substringBeforeLast('/')
            .ifBlank { "https://$WEB_HOST" }
            .let { candidate ->
                if (candidate.startsWith("http")) candidate else "https://$WEB_HOST"
            }
    }

    private fun webUrl(base: String, path: String): String {
        val normalizedBase = base.trimEnd('/')
        val normalizedPath = if (path.startsWith("/")) path else "/$path"
        return if (base.startsWith("file://")) {
            "$normalizedBase#$normalizedPath"
        } else {
            "$normalizedBase$normalizedPath"
        }
    }
}