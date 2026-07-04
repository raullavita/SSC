package com.supersecurechat.app

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.net.HttpURLConnection
import java.net.URL

/**
 * Injects X-SSC-Client on API requests from the WebView shell (Engine 11).
 */
object ApiClient {
    const val CLIENT_HEADER = "X-SSC-Client"
    const val CLIENT_VALUE = "android/0.1.0/1"

    fun attachInstalledClientHeaders(conn: HttpURLConnection) {
        conn.setRequestProperty(CLIENT_HEADER, CLIENT_VALUE)
    }

    fun webViewClient(baseUrl: String): WebViewClient = object : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
            val url = request?.url?.toString() ?: return super.shouldInterceptRequest(view, request)
            if (!url.contains("/api/")) {
                return super.shouldInterceptRequest(view, request)
            }
            return try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = request.method
                    attachInstalledClientHeaders(this)
                    request.requestHeaders.forEach { (k, v) ->
                        if (!k.equals(CLIENT_HEADER, ignoreCase = true)) {
                            setRequestProperty(k, v)
                        }
                    }
                }
                val stream = conn.inputStream
                val mime = conn.contentType ?: "application/json"
                WebResourceResponse(mime, conn.contentEncoding, stream)
            } catch (_: Exception) {
                super.shouldInterceptRequest(view, request)
            }
        }

        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
            view?.evaluateJavascript(
                "window.__SSC_ANDROID_CLIENT='$CLIENT_VALUE';",
                null
            )
            super.onPageStarted(view, url, favicon)
        }
    }
}