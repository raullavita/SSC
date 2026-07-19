package com.supersecurechat.app.data

import android.content.Intent
import android.net.Uri

sealed class DeepLinkRoute {
    data class AddUser(val username: String) : DeepLinkRoute()
    data class LinkDevice(val token: String?) : DeepLinkRoute()
    data class GoogleOAuth(val oauthCode: String?, val error: String?) : DeepLinkRoute()
    data class SafetyVerify(val peerId: String, val digits: String) : DeepLinkRoute()
}

object DeepLinkParser {
    private const val WEB_HOST = "www.supersecurechat.com"
    private const val API_HOST = "api.supersecurechat.com"

    fun parse(intent: Intent?): DeepLinkRoute? {
        val uri = intent?.data ?: return null
        return parseUri(uri)
    }

    fun parseUri(uri: Uri): DeepLinkRoute? {
        return when (uri.scheme?.lowercase()) {
            "ssc" -> when (uri.host?.lowercase()) {
                "add" -> {
                    val u = uri.path?.trim('/')?.ifBlank { null } ?: return null
                    DeepLinkRoute.AddUser(u)
                }
                "link-device" -> DeepLinkRoute.LinkDevice(uri.getQueryParameter("token"))
                "auth" -> DeepLinkRoute.GoogleOAuth(
                    uri.getQueryParameter("oauth_code"),
                    uri.getQueryParameter("error"),
                )
                "verify" -> {
                    val parts = uri.path?.trim('/')?.split("/") ?: return null
                    if (parts.size < 2) return null
                    DeepLinkRoute.SafetyVerify(parts[0], parts[1])
                }
                else -> null
            }
            "https", "http" -> {
                val host = uri.host?.lowercase() ?: return null
                when {
                    host == WEB_HOST && (uri.path?.startsWith("/add/") == true) -> {
                        val u = uri.path!!.removePrefix("/add/").trim('/')
                        if (u.isBlank()) null else DeepLinkRoute.AddUser(u)
                    }
                    host == WEB_HOST && uri.path?.startsWith("/link-device") == true -> {
                        DeepLinkRoute.LinkDevice(uri.getQueryParameter("token"))
                    }
                    host == API_HOST && uri.path?.contains("auth") == true -> {
                        DeepLinkRoute.GoogleOAuth(
                            uri.getQueryParameter("oauth_code"),
                            uri.getQueryParameter("error"),
                        )
                    }
                    else -> null
                }
            }
            else -> null
        }
    }
}
